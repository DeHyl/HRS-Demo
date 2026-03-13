import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { insertLeadSchema, type Lead } from "@shared/schema";
import { z } from "zod";
import { fetchLeadsFromSheet, parseLeadsFromSheet, detectColumnMapping, getSpreadsheetInfo } from "./google/sheetsClient";
import { researchLead, type ResearchOptions } from "./ai/leadResearch";
import { extractQualificationFromTranscript, QualificationDraft } from "./ai/qualificationExtractor";
import { notifyLeadStatusChange, notifyLeadQualified, notifyManagersOfQualifiedLead, notifyAEHandoff, notifyResearchReady } from "./notificationService";
import { notifyResearchComplete } from "./dashboardUpdates";
import pLimit from "p-limit";
import {
  buildDiscoveredInfoUpdates,
  isFallbackResearch,
  hasResearchableCompanyInfo,
  buildScoreUpdates,
  mergeLeadUpdates,
} from "./helpers/leadResearchHelpers";

// Limit concurrent research to 2 to avoid rate limits with Claude API
const researchLimit = pLimit(2);

// Track research in progress to prevent duplicate work
const researchInProgress = new Set<string>();

// Shared helper for processing lead research with all guardrails
export async function processLeadResearch(
  lead: Lead,
  options: { forceRefresh?: boolean; notifyUserId?: string; researchMode?: 'fast' | 'deep'; researchSources?: ResearchOptions['sources'] } = {}
): Promise<{ success: boolean; packet?: any; isExisting?: boolean; researchMode?: 'fast' | 'deep' }> {
  const { forceRefresh = false, notifyUserId, researchMode = 'fast', researchSources } = options;
  const leadId = lead.id;
  const leadName = lead.contactName || lead.companyName || leadId;

  // Check if research already in progress
  if (researchInProgress.has(leadId)) {
    console.log(`[LeadResearch] Already in progress for ${leadName}, skipping`);
    const existingPacket = await storage.getResearchPacketByLead(leadId);
    return { success: true, packet: existingPacket, isExisting: true };
  }

  // Skip if no company info
  if (!hasResearchableCompanyInfo(lead)) {
    console.log(`[LeadResearch] Skipping ${leadId} - no company info`);
    return { success: false };
  }

  // Check for existing research
  const existingPacket = await storage.getResearchPacketByLead(leadId);
  const existingIsFallback = isFallbackResearch(existingPacket);

  // Return existing if not forcing refresh and not fallback
  if (existingPacket && !forceRefresh && !existingIsFallback) {
    return { success: true, packet: existingPacket, isExisting: true };
  }

  // Mark as in progress
  researchInProgress.add(leadId);

  try {
    console.log(`[LeadResearch] Processing: ${leadName} (mode: ${researchMode})`);
    const researchResult = await researchLead(lead, { mode: researchMode, sources: researchSources });

    // Check if new result is fallback but existing was good
    if (existingPacket && !existingIsFallback && isFallbackResearch(researchResult.packet)) {
      console.log(`[LeadResearch] New result is fallback, keeping existing for ${leadName}`);
      return { success: true, packet: existingPacket, isExisting: true };
    }

    // Save research packet
    const researchPacket = existingPacket
      ? await storage.updateResearchPacket(existingPacket.id, researchResult.packet)
      : await storage.createResearchPacket(researchResult.packet);

    // Build and apply lead updates
    const discoveredUpdates = buildDiscoveredInfoUpdates(lead, researchResult.discoveredInfo);
    const scoreUpdates = buildScoreUpdates(researchPacket);
    const allUpdates = mergeLeadUpdates(discoveredUpdates, scoreUpdates);

    if (Object.keys(allUpdates).length > 0) {
      await storage.updateLead(leadId, allUpdates);
      console.log(`[LeadResearch] Updated lead ${leadId} with:`, Object.keys(allUpdates));
    }

    // Send notification if user ID provided
    if (notifyUserId) {
      await notifyResearchReady(notifyUserId, leadId, lead.contactName, lead.companyName);
    }

    console.log(`[LeadResearch] Completed: ${leadName} (mode: ${researchMode})`);
    return { success: true, packet: researchPacket, isExisting: false, researchMode };
  } catch (err: any) {
    console.error(`[LeadResearch] Failed for ${leadId}:`, err.message);
    return { success: false };
  } finally {
    researchInProgress.delete(leadId);
  }
}

// Background research processor for bulk imports
async function processResearchQueue(leads: Lead[]) {
  console.log(`[AutoResearch] Starting background research for ${leads.length} leads`);
  
  const researchPromises = leads.map(lead => 
    researchLimit(async () => {
      await processLeadResearch(lead);
    })
  );
  
  await Promise.allSettled(researchPromises);
  console.log(`[AutoResearch] Batch complete for ${leads.length} leads`);
}

// Validation schema for research packet updates (PATCH)
const updateResearchPacketSchema = z.object({
  companyIntel: z.string().optional(),
  contactIntel: z.string().optional(),
  painSignals: z.string().optional(),
  fitAnalysis: z.string().optional(),
  talkTrack: z.string().optional(),
  discoveryQuestions: z.string().optional(),
  objectionHandles: z.string().optional(),
  companyHardIntel: z.string().optional(),
  xIntel: z.string().optional(),
  linkedInIntel: z.string().optional(),
  competitorPresence: z.string().optional(),
  fitScore: z.number().int().min(0).max(100).optional(),
  priority: z.string().optional(),
}).strict();

// Validation schema for lead updates (PATCH)
const updateLeadSchema = z.object({
  companyName: z.string().min(1).optional(),
  companyWebsite: z.string().url().optional().or(z.literal("")),
  companyIndustry: z.string().optional(),
  companySize: z.string().optional(),
  contactName: z.string().min(1).optional(),
  contactTitle: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  contactLinkedIn: z.string().url().optional().or(z.literal("")),
  source: z.string().optional(),
  status: z.enum(["new", "researching", "contacted", "engaged", "qualified", "handed_off", "converted", "lost"]).optional(),
  fitScore: z.number().int().min(0).max(100).optional(),
  priority: z.string().optional(),
  assignedSdrId: z.string().optional(),
  assignedAeId: z.string().optional(),
  qualificationNotes: z.string().optional(),
  buySignals: z.string().optional(),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  decisionMakers: z.string().optional(),
  handedOffAt: z.string().datetime().or(z.date()).optional(),
  handedOffBy: z.string().optional(),
  nextFollowUpAt: z.string().datetime().or(z.date()).optional(),
  lastContactedAt: z.string().datetime().or(z.date()).optional(),
}).strict(); // Reject any fields not in this schema

export function registerLeadsRoutes(app: Express, requireAuth: (req: Request, res: Response, next: () => void) => void) {
  
  app.get("/api/leads", requireAuth, async (req: Request, res: Response) => {
    try {
      // Optimized: Single query with LEFT JOIN instead of N+1 queries
      // Before: 101 queries for 100 leads | After: 1 query! 🚀
      const leadsWithResearch = await storage.getAllLeadsWithResearch();

      res.json(leadsWithResearch);
    } catch (error) {
      console.error("Leads fetch error:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      const researchPacket = await storage.getResearchPacketByLead(lead.id);
      
      res.json({ lead, researchPacket });
    } catch (error) {
      console.error("Lead fetch error:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.get("/api/leads/:id/qualification-draft", requireAuth, async (req: Request, res: Response) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      const callSessions = await storage.getCallSessionsByLead(lead.id);
      const coachingSessions = await storage.getLiveCoachingSessionsByLead(lead.id);
      
      let transcript = "";
      
      if (callSessions.length > 0) {
        const recentSession = callSessions[0];
        if (recentSession.transcriptText) {
          transcript = recentSession.transcriptText;
        }
      }
      
      if (!transcript && coachingSessions.length > 0) {
        const recentSession = coachingSessions[0];
        const transcripts = await storage.getLiveTranscriptsBySession(recentSession.id);
        if (transcripts.length > 0) {
          transcript = transcripts
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map(t => `${t.speaker || "Speaker"}: ${t.content}`)
            .join("\n");
        }
      }

      if (!transcript) {
        return res.json({
          qualificationNotes: "",
          buySignals: "",
          budget: "",
          timeline: "",
          decisionMakers: "",
          source: "no_data",
          confidence: "low",
          message: "No call transcripts found for this lead"
        });
      }

      console.log(`[QualificationDraft] Extracting from ${transcript.length} chars of transcript for lead ${lead.id}`);
      
      const draft = await extractQualificationFromTranscript(
        transcript,
        lead.contactName,
        lead.companyName
      );

      res.json(draft);
    } catch (error) {
      console.error("Qualification draft error:", error);
      res.status(500).json({ message: "Failed to generate qualification draft" });
    }
  });

  app.post("/api/leads", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      
      const existingLead = await storage.getLeadByEmail(validatedData.contactEmail);
      if (existingLead) {
        return res.status(400).json({ message: "Lead with this email already exists" });
      }
      
      const lead = await storage.createLead(validatedData);
      
      // Auto-trigger research in background (non-blocking)
      if (lead.companyName || lead.companyWebsite) {
        console.log(`[AutoResearch] Triggering auto-research for new lead: ${lead.contactName || lead.companyName}`);
        processLeadResearch(lead).catch(err => {
          console.error(`[AutoResearch] Failed for ${lead.id}:`, err.message);
        });
      }
      
      res.status(201).json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid lead data", errors: error.errors });
      }
      console.error("Lead creation error:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.patch("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const existingLead = await storage.getLead(req.params.id);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Validate request body with Zod schema
      const validatedUpdates = updateLeadSchema.parse(req.body);

      // Convert date strings to Date objects
      const updates: any = { ...validatedUpdates };
      const oldStatus = existingLead.status;

      if (updates.handedOffAt && typeof updates.handedOffAt === 'string') {
        updates.handedOffAt = new Date(updates.handedOffAt);
      }
      if (updates.nextFollowUpAt && typeof updates.nextFollowUpAt === 'string') {
        updates.nextFollowUpAt = new Date(updates.nextFollowUpAt);
      }
      if (updates.lastContactedAt && typeof updates.lastContactedAt === 'string') {
        updates.lastContactedAt = new Date(updates.lastContactedAt);
      }

      const lead = await storage.updateLead(req.params.id, updates);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      if (updates.status && updates.status !== oldStatus) {
        const userId = req.session.userId!;
        const leadName = lead.contactName || lead.companyName;
        
        await notifyLeadStatusChange(userId, lead.id, leadName, oldStatus, updates.status);
        
        if (updates.status === "qualified") {
          await notifyLeadQualified(userId, lead.id, leadName, lead.companyName);
          
          const user = await storage.getUser(userId);
          if (user) {
            await notifyManagersOfQualifiedLead(lead.id, leadName, lead.companyName, user.name);
          }
        }
        
        if (updates.status === "handed_off" && updates.assignedAeId) {
          const ae = await storage.getAccountExecutive(updates.assignedAeId);
          if (ae) {
            await notifyAEHandoff(userId, lead.id, leadName, ae.name);
          }
        }
      }
      
      res.json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      console.error("Lead update error:", error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteLead(req.params.id);
      res.json({ message: "Lead deleted" });
    } catch (error) {
      console.error("Lead delete error:", error);
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });

  app.get("/api/leads/import/preview", requireAuth, async (req: Request, res: Response) => {
    try {
      let range = req.query.range as string | undefined;
      if (!range) {
        const info = await getSpreadsheetInfo();
        const firstSheet = info.sheets[0]?.title || "Sheet1";
        range = `${firstSheet}!A:Z`;
      }
      
      const { headers, rows, totalRows } = await fetchLeadsFromSheet(undefined, range);
      const columnMapping = detectColumnMapping(headers);
      
      const previewRows = rows.slice(0, 5);
      
      res.json({
        headers,
        previewRows,
        totalRows,
        columnMapping,
      });
    } catch (error) {
      console.error("Sheets preview error:", error);
      res.status(500).json({ message: "Failed to preview spreadsheet. Check Google credentials and LEADS_SPREADSHEET_ID." });
    }
  });

  app.get("/api/leads/import/spreadsheet-info", requireAuth, async (req: Request, res: Response) => {
    try {
      const info = await getSpreadsheetInfo();
      res.json(info);
    } catch (error) {
      console.error("Spreadsheet info error:", error);
      res.status(500).json({ message: "Failed to get spreadsheet info. Check Google credentials." });
    }
  });

  app.post("/api/leads/import", requireAuth, async (req: Request, res: Response) => {
    try {
      const { range, columnMapping } = req.body;
      
      let sheetRange = range;
      if (!sheetRange) {
        const info = await getSpreadsheetInfo();
        const firstSheet = info.sheets[0]?.title || "Sheet1";
        sheetRange = `${firstSheet}!A:Z`;
      }
      
      const { headers, rows } = await fetchLeadsFromSheet(undefined, sheetRange);
      const { leads: parsedLeads, skipped, errors } = parseLeadsFromSheet(headers, rows, columnMapping);
      
      const existingEmails = new Set<string>();
      const duplicates: string[] = [];
      const newLeads = [];
      
      for (const lead of parsedLeads) {
        const existing = await storage.getLeadByEmail(lead.contactEmail);
        if (existing || existingEmails.has(lead.contactEmail)) {
          duplicates.push(lead.contactEmail);
        } else {
          existingEmails.add(lead.contactEmail);
          newLeads.push(lead);
        }
      }
      
      const createdLeads = await storage.createLeads(newLeads);
      
      const AUTO_RESEARCH_THRESHOLD = 10;
      const requiresApproval = createdLeads.length > AUTO_RESEARCH_THRESHOLD;
      
      if (createdLeads.length > 0 && !requiresApproval) {
        console.log(`[AutoResearch] Queueing ${createdLeads.length} leads for background research`);
        processResearchQueue(createdLeads).catch(err => {
          console.error("[AutoResearch] Batch processing error:", err.message);
        });
      } else if (requiresApproval) {
        console.log(`[AutoResearch] Skipping auto-research for ${createdLeads.length} leads (exceeds threshold of ${AUTO_RESEARCH_THRESHOLD})`);
      }
      
      res.json({
        imported: createdLeads.length,
        skipped,
        duplicates: duplicates.length,
        duplicateEmails: duplicates.slice(0, 10),
        errors: errors.slice(0, 10),
        leads: createdLeads,
        researchQueued: requiresApproval ? 0 : createdLeads.length,
        requiresResearchApproval: requiresApproval,
        approvalThreshold: AUTO_RESEARCH_THRESHOLD,
      });
    } catch (error) {
      console.error("Leads import error:", error);
      res.status(500).json({ message: "Failed to import leads from spreadsheet" });
    }
  });

  app.post("/api/leads/:id/research", requireAuth, async (req: Request, res: Response) => {
    try {
      const leadId = req.params.id;
      const lead = await storage.getLead(leadId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      const forceRefresh = req.query.refresh === "true";
      const userId = req.session.userId!;

      // Extract research mode and sources from request body
      const { mode = 'fast', sources } = req.body as { mode?: 'fast' | 'deep'; sources?: ResearchOptions['sources'] };

      const result = await processLeadResearch(lead, {
        forceRefresh,
        notifyUserId: userId,
        researchMode: mode,
        researchSources: sources
      });

      if (!result.success && !result.packet) {
        return res.status(500).json({ message: "Failed to research lead" });
      }

      // Notify connected clients about completed research
      if (!result.isExisting && userId) {
        notifyResearchComplete(leadId, userId);
      }

      res.json({
        message: result.isExisting ? "Research already exists" : `Research completed (${result.researchMode || 'fast'} mode)`,
        researchPacket: result.packet,
        isExisting: result.isExisting,
        researchMode: result.researchMode || 'fast'
      });
    } catch (error) {
      console.error("Lead research error:", error);
      res.status(500).json({ message: "Failed to research lead" });
    }
  });

  app.get("/api/leads/:id/research", requireAuth, async (req: Request, res: Response) => {
    try {
      const researchPacket = await storage.getResearchPacketByLead(req.params.id);
      if (!researchPacket) {
        return res.status(404).json({ message: "No research found for this lead" });
      }
      res.json(researchPacket);
    } catch (error) {
      console.error("Research fetch error:", error);
      res.status(500).json({ message: "Failed to fetch research" });
    }
  });

  app.get("/api/leads/:id/calls", requireAuth, async (req: Request, res: Response) => {
    try {
      const callHistory = await storage.getCallSessionsByLead(req.params.id);
      res.json(callHistory);
    } catch (error) {
      console.error("Call history fetch error:", error);
      res.status(500).json({ message: "Failed to fetch call history" });
    }
  });

  // Lead details for modal - aggregates lead, research, calls, and SDR info
  app.get("/api/leads/:id/details", requireAuth, async (req: Request, res: Response) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Get research packet
      const research = await storage.getResearchPacketByLead(lead.id);

      // Get call history
      const callHistory = await storage.getCallSessionsByLead(lead.id);

      // Get assigned SDR info if exists
      let assignedSdr = null;
      if (lead.assignedSdrId) {
        assignedSdr = await storage.getSdr(lead.assignedSdrId);
      }

      res.json({
        lead,
        research: research ? {
          id: research.id,
          companyIntel: research.companyIntel,
          contactIntel: research.contactIntel,
          painSignals: research.painSignals,
          talkTrack: research.talkTrack,
          discoveryQuestions: research.discoveryQuestions,
          objectionHandles: research.objectionHandles,
          confidence: research.confidence,
          createdAt: research.createdAt,
        } : null,
        callHistory: callHistory.map(call => ({
          id: call.id,
          disposition: call.disposition,
          duration: call.duration,
          startedAt: call.startedAt,
          keyTakeaways: call.keyTakeaways,
          nextSteps: call.nextSteps,
          sdrNotes: call.sdrNotes,
        })),
        assignedSdr: assignedSdr ? {
          id: assignedSdr.id,
          name: assignedSdr.name,
          email: assignedSdr.email,
        } : null,
      });
    } catch (error) {
      console.error("Lead details fetch error:", error);
      res.status(500).json({ message: "Failed to fetch lead details" });
    }
  });

  app.delete("/api/leads/:id/research", requireAuth, async (req: Request, res: Response) => {
    try {
      const researchPacket = await storage.getResearchPacketByLead(req.params.id);
      if (!researchPacket) {
        return res.status(404).json({ message: "No research found for this lead" });
      }
      await storage.deleteResearchPacket(researchPacket.id);
      
      await storage.updateLead(req.params.id, {
        fitScore: null,
        priority: null
      });
      
      res.json({ message: "Research deleted successfully" });
    } catch (error) {
      console.error("Research deletion error:", error);
      res.status(500).json({ message: "Failed to delete research" });
    }
  });

  app.post("/api/leads/batch-research", requireAuth, async (req: Request, res: Response) => {
    try {
      const { leadIds } = req.body;
      
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ message: "leadIds array is required" });
      }
      
      const leads: Lead[] = [];
      for (const id of leadIds) {
        const lead = await storage.getLead(id);
        if (lead && (lead.companyName || lead.companyWebsite)) {
          leads.push(lead);
        }
      }
      
      if (leads.length === 0) {
        return res.status(400).json({ message: "No valid leads found for research" });
      }
      
      console.log(`[BatchResearch] User approved research for ${leads.length} leads`);
      processResearchQueue(leads).catch(err => {
        console.error("[BatchResearch] Batch processing error:", err.message);
      });
      
      res.json({
        message: `Research queued for ${leads.length} leads`,
        queued: leads.length,
      });
    } catch (error) {
      console.error("Batch research error:", error);
      res.status(500).json({ message: "Failed to queue batch research" });
    }
  });

  app.patch("/api/leads/:id/research", requireAuth, async (req: Request, res: Response) => {
    try {
      const researchPacket = await storage.getResearchPacketByLead(req.params.id);
      if (!researchPacket) {
        return res.status(404).json({ message: "No research found for this lead" });
      }

      // Validate request body with Zod schema
      const validatedUpdates = updateResearchPacketSchema.parse(req.body);
      const updates: Record<string, unknown> = { ...validatedUpdates };

      // Remove undefined fields
      for (const key in updates) {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      updates.updatedAt = new Date();
      
      const updatedPacket = await storage.updateResearchPacket(researchPacket.id, updates);
      
      const leadUpdates: Record<string, unknown> = {};
      if ('fitScore' in updates) {
        leadUpdates.fitScore = updates.fitScore;
      }
      if ('priority' in updates) {
        leadUpdates.priority = updates.priority;
      }
      if (Object.keys(leadUpdates).length > 0) {
        await storage.updateLead(req.params.id, leadUpdates);
      }
      
      res.json(updatedPacket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      console.error("Research update error:", error);
      res.status(500).json({ message: "Failed to update research" });
    }
  });
}
