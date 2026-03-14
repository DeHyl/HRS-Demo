import type { Express, Request, Response, NextFunction } from "express";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getConnectionStatus,
  disconnect,
  isConnected,
} from "./integrations/salesforceClient";
import {
  importLeadsFromSalesforce,
  pushLeadToSalesforce,
  handoverToSalesforce,
  getSyncLogs,
} from "./integrations/salesforceLeads";
import { storage } from "./storage";
import { quickScoreLead } from "./ai/quickLeadQualifier";
import { generateLeadResponseEmail } from "./ai/leadResponseEmailGenerator";
import { sendFeedbackEmail } from "./google/gmailClient";
import { db } from "./db";
import { leadResponseLog } from "@shared/schema";

export function registerSalesforceRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: NextFunction) => void
) {
  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    next();
  };
  app.get("/api/salesforce/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const status = await getConnectionStatus();
      res.json(status);
    } catch (error) {
      console.error("[Salesforce] Status check error:", error);
      res.json({ connected: false });
    }
  });

  app.get("/api/salesforce/connect", requireAdmin, async (req: Request, res: Response) => {
    try {
      const authUrl = getAuthorizationUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error("[Salesforce] Auth URL error:", error);
      res.status(500).json({ message: "Failed to generate Salesforce authorization URL. Check credentials." });
    }
  });

  app.get("/api/salesforce/callback", async (req: Request, res: Response) => {
    try {
      const { code, error, error_description } = req.query;
      
      if (error) {
        console.error("[Salesforce] OAuth error:", error, error_description);
        return res.redirect("/?salesforce_error=" + encodeURIComponent(String(error_description || error)));
      }
      
      if (!code || typeof code !== "string") {
        return res.status(400).json({ message: "Missing authorization code" });
      }
      
      await exchangeCodeForTokens(code);
      
      res.redirect("/?salesforce_connected=true");
    } catch (error) {
      console.error("[Salesforce] Callback error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      res.redirect("/?salesforce_error=" + encodeURIComponent(errorMsg));
    }
  });

  app.post("/api/salesforce/disconnect", requireAdmin, async (req: Request, res: Response) => {
    try {
      await disconnect();
      res.json({ success: true });
    } catch (error) {
      console.error("[Salesforce] Disconnect error:", error);
      res.status(500).json({ message: "Failed to disconnect Salesforce" });
    }
  });

  app.post("/api/salesforce/import", requireAdmin, async (req: Request, res: Response) => {
    try {
      const connected = await isConnected();
      if (!connected) {
        return res.status(400).json({ message: "Salesforce not connected" });
      }
      
      const { ownerId, status, limit } = req.body;
      
      const result = await importLeadsFromSalesforce({
        ownerId,
        status,
        limit: limit || 100,
      });
      
      res.json(result);
    } catch (error) {
      console.error("[Salesforce] Import error:", error);
      const errorMsg = error instanceof Error ? error.message : "Import failed";
      res.status(500).json({ message: errorMsg });
    }
  });

  app.post("/api/leads/:id/push-to-salesforce", requireAuth, async (req: Request, res: Response) => {
    try {
      const connected = await isConnected();
      if (!connected) {
        return res.status(400).json({ message: "Salesforce not connected" });
      }
      
      const { id } = req.params;
      const { includeResearch, includeCallNotes } = req.body;
      
      const result = await pushLeadToSalesforce(id, {
        includeResearch,
        includeCallNotes,
      });
      
      res.json(result);
    } catch (error) {
      console.error("[Salesforce] Push error:", error);
      const errorMsg = error instanceof Error ? error.message : "Push failed";
      res.status(500).json({ message: errorMsg });
    }
  });

  app.post("/api/leads/:id/handover-salesforce", requireAuth, async (req: Request, res: Response) => {
    try {
      const connected = await isConnected();
      if (!connected) {
        return res.status(400).json({ message: "Salesforce not connected" });
      }
      
      const { id } = req.params;
      const { accountExecutiveEmail, convertToOpportunity } = req.body;
      
      const result = await handoverToSalesforce(id, {
        accountExecutiveEmail,
        convertToOpportunity,
      });
      
      res.json(result);
    } catch (error) {
      console.error("[Salesforce] Handover error:", error);
      const errorMsg = error instanceof Error ? error.message : "Handover failed";
      res.status(500).json({ message: errorMsg });
    }
  });

  app.get("/api/salesforce/sync-logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const logs = await getSyncLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("[Salesforce] Sync logs error:", error);
      res.status(500).json({ message: "Failed to fetch sync logs" });
    }
  });

  // ─── Lead Response Engine — Webhook ──────────────────────────────────────────
  // Called by Salesforce when a new Lead record is created.
  // No session auth required (Salesforce is the caller).
  // Optional: set env SALESFORCE_WEBHOOK_SECRET and SF will send it as
  //   X-Salesforce-Webhook-Secret header for basic verification.
  app.post("/api/salesforce/webhook/lead-created", async (req: Request, res: Response) => {
    // Respond to Salesforce immediately — don't block on our pipeline
    res.status(200).json({ received: true });

    const startTime = Date.now();
    const leadData = req.body;

    // Optional secret verification
    const expectedSecret = process.env.SALESFORCE_WEBHOOK_SECRET;
    if (expectedSecret) {
      const incomingSecret = req.headers["x-salesforce-webhook-secret"];
      if (incomingSecret !== expectedSecret) {
        console.warn("[LeadResponse] Webhook secret mismatch — ignoring");
        return;
      }
    }

    const leadId = leadData.Id || leadData.id || "unknown";
    const email = leadData.Email || leadData.email;

    if (!email) {
      console.log(`[LeadResponse] Skipping lead ${leadId} — no email`);
      return;
    }

    console.log(`[LeadResponse] Processing lead ${leadId} (${email})`);

    try {
      // Step 1: Quick qualification
      const qualification = await quickScoreLead(leadData);
      console.log(`[LeadResponse] Lead ${leadId} — score ${qualification.score}: ${qualification.reason}`);

      if (!qualification.shouldRespond) {
        // Log as skipped
        await db.insert(leadResponseLog).values({
          leadId,
          leadEmail: email,
          leadName: `${leadData.FirstName || ""} ${leadData.LastName || ""}`.trim() || null,
          company: leadData.Company || null,
          industry: leadData.Industry || null,
          title: leadData.Title || null,
          leadSource: leadData.LeadSource || null,
          emailSubject: "N/A",
          emailBody: "Skipped — below qualification threshold",
          status: "skipped",
          qualScore: qualification.score,
          qualReason: qualification.reason,
          processingMs: Date.now() - startTime,
        });
        return;
      }

      // Step 2: Generate personalized email
      const email_content = await generateLeadResponseEmail(leadData);

      // Step 3: Send via Gmail
      await sendFeedbackEmail({
        to: email,
        subject: email_content.subject,
        body: email_content.body,
      });

      // Step 4: Log success
      await db.insert(leadResponseLog).values({
        leadId,
        leadEmail: email,
        leadName: `${leadData.FirstName || ""} ${leadData.LastName || ""}`.trim() || null,
        company: leadData.Company || null,
        industry: leadData.Industry || null,
        title: leadData.Title || null,
        leadSource: leadData.LeadSource || null,
        emailSubject: email_content.subject,
        emailBody: email_content.body,
        status: "sent",
        qualScore: qualification.score,
        qualReason: qualification.reason,
        processingMs: Date.now() - startTime,
      });

      console.log(
        `[LeadResponse] ✅ Responded to ${email} in ${Date.now() - startTime}ms — "${email_content.subject}"`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[LeadResponse] Pipeline error for ${leadId}:`, errorMsg);

      // Log failure
      try {
        await db.insert(leadResponseLog).values({
          leadId,
          leadEmail: email,
          leadName: `${leadData.FirstName || ""} ${leadData.LastName || ""}`.trim() || null,
          company: leadData.Company || null,
          industry: leadData.Industry || null,
          title: leadData.Title || null,
          leadSource: leadData.LeadSource || null,
          emailSubject: "N/A",
          emailBody: `Pipeline error: ${errorMsg}`,
          status: "failed",
          qualScore: null,
          qualReason: errorMsg,
          processingMs: Date.now() - startTime,
        });
      } catch (logErr) {
        console.error("[LeadResponse] Failed to log error:", logErr);
      }
    }
  });

  // ─── Lead Response Engine — Admin: view log ───────────────────────────────
  app.get("/api/lead-responses", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { desc } = await import("drizzle-orm");
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await db
        .select()
        .from(leadResponseLog)
        .orderBy(desc(leadResponseLog.sentAt))
        .limit(limit);
      res.json(logs);
    } catch (error) {
      console.error("[LeadResponse] Fetch logs error:", error);
      res.status(500).json({ message: "Failed to fetch lead response logs" });
    }
  });
}
