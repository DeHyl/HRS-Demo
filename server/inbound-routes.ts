/**
 * Inbound Email Agent Routes
 * POST /api/inbound/email  — process an inbound prospect email
 * GET  /api/inbound/emails — list leads sourced from inbound emails
 * POST /api/inbound/email/:id/send — send the drafted reply
 */

import { Express, Request, Response } from "express";
import { analyzeInboundEmail } from "./ai/inboundEmailAgent.js";
import { storage } from "./storage.js";
import { sendFeedbackEmail } from "./google/gmailClient.js";
import { createNotification } from "./notificationService.js";
import { db } from "./db.js";
import { gmailProcessedMessages } from "@shared/schema";
import { asc, desc, eq } from "drizzle-orm";

export function registerInboundRoutes(app: Express, requireAuth: Function) {
  /**
   * POST /api/inbound/email
   * Submit an inbound email for AI analysis.
   * Creates a lead if the sender is new, returns analysis + draft response.
   */
  app.post("/api/inbound/email", requireAuth, async (req: Request, res: Response) => {
    try {
      const { from, subject, body, autoReply = false } = req.body;

      if (!from || !body) {
        return res.status(400).json({ message: "from and body are required" });
      }

      // 1. Run AI analysis
      const analysis = await analyzeInboundEmail({
        from,
        subject: subject || "(no subject)",
        body,
      });

      // 2. Deduplicate by email
      const existing = await storage.getLeadByEmail(analysis.senderEmail);
      let lead = existing || null;
      let isNewLead = false;

      if (!existing && analysis.senderEmail) {
        // 3. Auto-create lead from inbound email
        const priority =
          analysis.engagementScore >= 4
            ? "hot"
            : analysis.engagementScore >= 3
            ? "warm"
            : analysis.engagementScore >= 2
            ? "cool"
            : "cold";

        lead = await storage.createLead({
          companyName: analysis.senderCompany || analysis.senderDomain || "Unknown",
          contactName: analysis.senderName || analysis.senderEmail,
          contactEmail: analysis.senderEmail,
          companyWebsite: analysis.senderDomain ? `https://${analysis.senderDomain}` : undefined,
          source: "inbound_email",
          status: "new",
          fitScore: Math.round(analysis.engagementScore * 20),
          priority,
          qualificationNotes: `Intent: ${analysis.intent}. Buyer stage: ${analysis.buyerStage}. Questions: ${analysis.questionsAsked.join("; ")}`,
          buySignals:
            analysis.urgencySignals.length > 0
              ? analysis.urgencySignals.join("; ")
              : undefined,
          lastContactedAt: new Date(),
        });
        isNewLead = true;
      }

      // 4. Send auto-reply if requested
      let autoReplySent = false;
      if (autoReply && analysis.senderEmail) {
        try {
          await sendFeedbackEmail({
            to: analysis.senderEmail,
            subject: `Re: ${subject || "(no subject)"}`,
            body: analysis.suggestedResponse.replace(/\n/g, "<br>"),
          });
          autoReplySent = true;
        } catch (emailErr) {
          console.warn("[InboundAgent] Could not send auto-reply:", emailErr);
        }
      }

      // 5. Notify managers on hot leads
      if (analysis.escalateToHuman) {
        const allUsers = await storage.getAllUsers();
        const managers = allUsers.filter(
          (u) => u.role === "manager" || u.role === "admin"
        );
        for (const mgr of managers) {
          await createNotification({
            userId: mgr.id,
            type: "lead_qualified",
            title: "🔥 Hot Inbound Lead",
            message: `${analysis.senderName} at ${analysis.senderCompany} — Engagement ${analysis.engagementScore}/5. ${analysis.escalationReason || ""}`,
            entityType: "lead",
            entityId: lead?.id,
          });
        }
      }

      res.json({ analysis, lead, isNewLead, autoReplySent });
    } catch (err: any) {
      console.error("[InboundAgent] Error:", err);
      res.status(500).json({ message: "Failed to process inbound email", detail: err?.message });
    }
  });


  // GET /api/inbound/activity — all processed emails with lead info, sorted by recent
  app.get("/api/inbound/activity", requireAuth, async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await db.select().from(gmailProcessedMessages)
      .orderBy(desc(gmailProcessedMessages.processedAt))
      .limit(limit);
    res.json(logs);
  });

  // GET /api/inbound/thread/:threadId — all messages in a thread
  app.get("/api/inbound/thread/:threadId", requireAuth, async (req: Request, res: Response) => {
    const messages = await db.select().from(gmailProcessedMessages)
      .where(eq(gmailProcessedMessages.threadId, req.params.threadId))
      .orderBy(asc(gmailProcessedMessages.processedAt));
    res.json(messages);
  });

  // PATCH /api/inbound/thread/:threadId/takeover — human takes over, AI stops
  app.patch("/api/inbound/thread/:threadId/takeover", requireAuth, async (req: Request, res: Response) => {
    const { paused } = req.body; // true = pause AI, false = resume AI
    const nextPaused = paused ?? true;

    await db.update(gmailProcessedMessages)
      .set({
        paused: nextPaused,
        pausedBy: nextPaused ? req.session.userId : null,
        pausedAt: nextPaused ? new Date() : null,
      })
      .where(eq(gmailProcessedMessages.threadId, req.params.threadId));

    res.json({ success: true, paused: nextPaused });
  });

  /**
   * GET /api/inbound/emails
   * Returns all leads sourced from inbound emails (for the queue UI).
   */
  app.get("/api/inbound/emails", requireAuth, async (req: Request, res: Response) => {
    try {
      const allLeads = await storage.getAllLeads();
      const inbound = allLeads.filter((l) => l.source === "inbound_email");
      res.json(inbound);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch inbound leads" });
    }
  });

  /**
   * POST /api/inbound/email/send-reply
   * Send a (potentially edited) reply to a prospect.
   */
  app.post("/api/inbound/email/send-reply", requireAuth, async (req: Request, res: Response) => {
    try {
      const { to, subject, body } = req.body;
      if (!to || !body) {
        return res.status(400).json({ message: "to and body are required" });
      }

      await sendFeedbackEmail({
        to,
        subject: subject || "Following up from Hawk Ridge Systems",
        body: body.replace(/\n/g, "<br>"),
      });

      res.json({ sent: true });
    } catch (err: any) {
      console.warn("[InboundAgent] Send reply error:", err);
      // If Gmail not configured, return graceful degradation
      res.json({ sent: false, reason: "Gmail not configured — reply copied to clipboard" });
    }
  });
}
