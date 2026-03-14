/**
 * am-routes.ts
 * AM Research Workspace — Account Manager intelligence endpoints.
 *
 * Endpoints:
 *   GET  /api/am/accounts                    — aggregated account coverage + whitespace
 *   POST /api/am/accounts/discover-contacts  — find new contacts at a specific company
 *   GET  /api/am/accounts/salesforce-history — Salesforce Account + Opportunity + Task data
 */

import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { isConnected, salesforceRequest } from "./integrations/salesforceClient";
import { runProspector, type ProspectSearchCriteria } from "./ai/prospectorAgent";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AccountSummary {
  companyName: string;
  companyWebsite: string | null;
  companyIndustry: string | null;
  leadCount: number;
  avgFitScore: number | null;
  lastActivityDate: string | null;   // ISO string or null
  hasActiveSdr: boolean;
  coverageStatus: "active" | "stale" | "dark";
  whitespaceScore: number;           // 0–100, higher = more opportunity
  topLead: {
    id: string;
    contactName: string;
    contactTitle: string | null;
    fitScore: number | null;
    status: string;
  } | null;
  leadIds: string[];
}

interface SalesforceAccountRecord {
  Id: string;
  Name: string;
  Industry: string | null;
  AnnualRevenue: number | null;
  NumberOfEmployees: number | null;
  BillingCity: string | null;
  BillingState: string | null;
}

interface SalesforceOpportunityRecord {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number | null;
  CloseDate: string;
  IsClosed: boolean;
  IsWon: boolean;
  AccountId: string;
}

interface SalesforceTaskRecord {
  Id: string;
  Subject: string;
  ActivityDate: string | null;
  Status: string | null;
  WhatId: string | null;
  Description: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function escapeSOQL(value: string): string {
  return value.replace(/'/g, "\\'");
}

const NOW_MS = () => Date.now();
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Aggregate all leads in the DB by company name and return coverage + whitespace metrics.
 */
async function aggregateAccountSummaries(): Promise<AccountSummary[]> {
  const allLeads = await storage.getAllLeads();

  // Group by normalized company name
  const groups = new Map<string, typeof allLeads>();
  for (const lead of allLeads) {
    const key = lead.companyName.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(lead);
  }

  const summaries: AccountSummary[] = [];

  for (const [, groupLeads] of groups) {
    const representative = groupLeads[0];

    // Last activity: MAX of lastContactedAt across all leads in group
    let lastActivityDate: Date | null = null;
    for (const l of groupLeads) {
      if (l.lastContactedAt) {
        const d = new Date(l.lastContactedAt);
        if (!lastActivityDate || d > lastActivityDate) lastActivityDate = d;
      }
    }

    // Coverage status
    let coverageStatus: "active" | "stale" | "dark";
    if (!lastActivityDate) {
      coverageStatus = "dark";
    } else if (NOW_MS() - lastActivityDate.getTime() > THIRTY_DAYS_MS) {
      coverageStatus = "stale";
    } else {
      coverageStatus = "active";
    }

    const hasActiveSdr = groupLeads.some((l) => l.assignedSdrId != null);

    // Avg fit score
    const scoresWithValue = groupLeads.filter((l) => l.fitScore != null);
    const avgFitScore =
      scoresWithValue.length > 0
        ? Math.round(
            scoresWithValue.reduce((sum, l) => sum + (l.fitScore ?? 0), 0) /
              scoresWithValue.length
          )
        : null;

    // Whitespace score: higher = more opportunity untapped
    let whitespace = 100;
    if (coverageStatus === "active") whitespace -= 35;
    else if (coverageStatus === "stale") whitespace -= 15;
    if (hasActiveSdr) whitespace -= 20;
    if (avgFitScore != null) {
      // High fit = higher opportunity, so DON'T penalize for high fit
      // Penalize low fit (less worth pursuing)
      if (avgFitScore < 50) whitespace -= 20;
      else if (avgFitScore < 65) whitespace -= 10;
    }
    if (groupLeads.length >= 3) whitespace -= 10; // already well-covered
    whitespace = Math.max(0, Math.min(100, whitespace));

    // Top lead: highest fitScore
    const topLead = groupLeads.reduce<(typeof groupLeads)[0] | null>((best, l) => {
      if (!best) return l;
      if ((l.fitScore ?? -1) > (best.fitScore ?? -1)) return l;
      return best;
    }, null);

    summaries.push({
      companyName: representative.companyName,
      companyWebsite: representative.companyWebsite ?? null,
      companyIndustry: representative.companyIndustry ?? null,
      leadCount: groupLeads.length,
      avgFitScore,
      lastActivityDate: lastActivityDate ? lastActivityDate.toISOString() : null,
      hasActiveSdr,
      coverageStatus,
      whitespaceScore: whitespace,
      topLead: topLead
        ? {
            id: topLead.id,
            contactName: topLead.contactName,
            contactTitle: topLead.contactTitle ?? null,
            fitScore: topLead.fitScore ?? null,
            status: topLead.status,
          }
        : null,
      leadIds: groupLeads.map((l) => l.id),
    });
  }

  // Sort: dark first, then stale, then by whitespaceScore desc
  summaries.sort((a, b) => {
    const order = { dark: 0, stale: 1, active: 2 };
    const statusDiff = order[a.coverageStatus] - order[b.coverageStatus];
    if (statusDiff !== 0) return statusDiff;
    return b.whitespaceScore - a.whitespaceScore;
  });

  return summaries;
}

// ─── Route registration ────────────────────────────────────────────────────────

export function registerAmRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: () => void) => void
) {
  /**
   * GET /api/am/accounts
   * Returns all accounts aggregated from the leads table with coverage + whitespace metrics.
   */
  app.get("/api/am/accounts", requireAuth, async (req: Request, res: Response) => {
    try {
      const accounts = await aggregateAccountSummaries();
      res.json({ accounts, total: accounts.length });
    } catch (err) {
      console.error("[AM] accounts error:", err);
      res.status(500).json({ message: "Failed to aggregate account data" });
    }
  });

  /**
   * POST /api/am/accounts/discover-contacts
   * Runs the Prospector targeting a specific company to find additional contacts.
   *
   * Body: { companyName: string, companyWebsite?: string | null, existingLeadIds?: string[] }
   */
  app.post(
    "/api/am/accounts/discover-contacts",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { companyName, companyWebsite, existingLeadIds } = req.body as {
          companyName: string;
          companyWebsite?: string | null;
          existingLeadIds?: string[];
        };

        if (!companyName?.trim()) {
          return res.status(400).json({ message: "companyName is required" });
        }

        // Build existing contact names to avoid re-discovering known people
        let existingContactNames: string[] = [];
        if (existingLeadIds?.length) {
          const allLeads = await storage.getAllLeads();
          existingContactNames = allLeads
            .filter((l) => existingLeadIds.includes(l.id))
            .map((l) => l.contactName)
            .filter(Boolean);
        }

        const keywords: string[] = ["engineering", "manufacturing", "CAD", "PLM"];
        if (companyWebsite) keywords.unshift(companyWebsite);

        const criteria: ProspectSearchCriteria = {
          industry: companyName,
          keywords,
          contactTitle: "Director OR Manager OR Engineer",
          maxResults: 8,
          minFitScore: 0,
        };

        const result = await runProspector(criteria, existingContactNames);

        res.json({
          companyName,
          discovered: result.discovered,
          added: result.added,
          contacts: result.results,
          durationMs: result.durationMs,
        });
      } catch (err) {
        console.error("[AM] discover-contacts error:", err);
        res.status(500).json({ message: "Contact discovery failed" });
      }
    }
  );

  /**
   * GET /api/am/accounts/salesforce-history?company=X
   * Pulls Account + Opportunity + Task data from Salesforce for a company name.
   */
  app.get(
    "/api/am/accounts/salesforce-history",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const company = String(req.query.company ?? "").trim();
        if (!company) {
          return res.status(400).json({ message: "company query param is required" });
        }

        const connected = await isConnected();
        if (!connected) {
          return res.json({
            connected: false,
            message: "Salesforce is not connected. Go to Settings to connect.",
          });
        }

        const escapedName = escapeSOQL(company);

        // Step 1: Find matching Accounts
        const accountQuery = `SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, BillingCity, BillingState FROM Account WHERE Name LIKE '%${escapedName}%' ORDER BY LastModifiedDate DESC LIMIT 5`;

        const accountResp = await salesforceRequest<{
          totalSize: number;
          records: SalesforceAccountRecord[];
        }>(`/services/data/v59.0/query?q=${encodeURIComponent(accountQuery)}`);

        if (!accountResp.records.length) {
          return res.json({
            connected: true,
            company,
            accounts: [],
            opportunities: [],
            activities: [],
          });
        }

        const accountIds = accountResp.records.map((a) => `'${a.Id}'`).join(",");

        // Steps 2 & 3 in parallel
        const oppQuery = `SELECT Id, Name, StageName, Amount, CloseDate, IsClosed, IsWon, AccountId FROM Opportunity WHERE AccountId IN (${accountIds}) ORDER BY CloseDate DESC LIMIT 20`;
        const taskQuery = `SELECT Id, Subject, ActivityDate, Status, WhatId, Description FROM Task WHERE WhatId IN (${accountIds}) ORDER BY ActivityDate DESC LIMIT 20`;

        const [oppResp, taskResp] = await Promise.all([
          salesforceRequest<{ totalSize: number; records: SalesforceOpportunityRecord[] }>(
            `/services/data/v59.0/query?q=${encodeURIComponent(oppQuery)}`
          ),
          salesforceRequest<{ totalSize: number; records: SalesforceTaskRecord[] }>(
            `/services/data/v59.0/query?q=${encodeURIComponent(taskQuery)}`
          ).catch(() => ({ records: [] as SalesforceTaskRecord[] })),
        ]);

        res.json({
          connected: true,
          company,
          accounts: accountResp.records,
          opportunities: oppResp.records,
          activities: taskResp.records,
        });
      } catch (err) {
        console.error("[AM] salesforce-history error:", err);
        res.status(500).json({ message: "Failed to fetch Salesforce history" });
      }
    }
  );
}
