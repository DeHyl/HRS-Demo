/**
 * quickLeadQualifier.ts
 * Fast lead scorer for the Lead Response Engine.
 * Uses Claude (haiku for speed) or falls back to rule-based scoring.
 * Target: <3 seconds total
 */

export interface SalesforceLeadWebhookPayload {
  Id?: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Company?: string;
  Title?: string;
  Industry?: string;
  LeadSource?: string;
  Phone?: string;
  NumberOfEmployees?: number | string;
  AnnualRevenue?: number | string;
  Description?: string;
  [key: string]: unknown;
}

export interface LeadQualScore {
  score: number;       // 0–100
  reason: string;      // 1-line human-readable explanation
  shouldRespond: boolean;
}

// ─── Rule-based scoring (fallback / fast path) ────────────────────────────────

const HIGH_VALUE_TITLES = [
  "vp", "vice president", "director", "head of", "chief", "cto", "ceo", "coo",
  "manager", "engineer", "engineering", "cad", "design", "manufacturing",
  "product", "mechanical", "solidworks", "catia", "3d", "simulation",
];

const HIGH_VALUE_INDUSTRIES = [
  "manufacturing", "engineering", "aerospace", "automotive", "defense",
  "industrial", "machinery", "electronics", "medical device", "robotics",
  "construction", "architecture", "technology", "software",
];

function ruleBasedScore(lead: SalesforceLeadWebhookPayload): LeadQualScore {
  let score = 50; // baseline
  const reasons: string[] = [];

  // Title signals
  const title = (lead.Title || "").toLowerCase();
  const titleMatches = HIGH_VALUE_TITLES.filter(t => title.includes(t));
  if (titleMatches.length > 0) {
    score += 20;
    reasons.push(`title "${lead.Title}" matches engineering/decision-maker profile`);
  }

  // Industry signals
  const industry = (lead.Industry || "").toLowerCase();
  const industryMatches = HIGH_VALUE_INDUSTRIES.filter(i => industry.includes(i));
  if (industryMatches.length > 0) {
    score += 15;
    reasons.push(`industry "${lead.Industry}" is HRS target vertical`);
  }

  // No email = can't respond
  if (!lead.Email) {
    score = 0;
    return { score: 0, reason: "No email address available", shouldRespond: false };
  }

  // Company present
  if (lead.Company) {
    score += 5;
  }

  // Lead source bonus (web/referral = high intent)
  const source = (lead.LeadSource || "").toLowerCase();
  if (source.includes("web") || source.includes("referral") || source.includes("inbound")) {
    score += 10;
    reasons.push("high-intent lead source");
  }

  score = Math.min(100, Math.max(0, score));
  const reason = reasons.length > 0 ? reasons.join("; ") : "standard lead — baseline score";

  return {
    score,
    reason,
    shouldRespond: score >= 40,
  };
}

// ─── AI-assisted scoring (when Claude is available) ───────────────────────────

async function aiScore(lead: SalesforceLeadWebhookPayload): Promise<LeadQualScore> {
  const { callClaudeWithRetry } = await import("./claudeClient");

  const prompt = `You are a B2B sales qualification expert for HawkRidge Systems (HRS), a SOLIDWORKS, CATIA, and 3D printing software reseller.

Score this inbound lead from 0–100 on likelihood they're a good fit for HRS:

Lead:
- Name: ${lead.FirstName} ${lead.LastName}
- Title: ${lead.Title || "unknown"}
- Company: ${lead.Company || "unknown"}
- Industry: ${lead.Industry || "unknown"}
- Lead Source: ${lead.LeadSource || "unknown"}

Scoring guide:
- 80–100: Engineering/manufacturing decision-maker in a target vertical (aerospace, automotive, manufacturing, medical device)
- 60–79: Engineering-adjacent role or non-target vertical but promising
- 40–59: Unknown fit, worth a quick outreach
- 0–39: Clearly wrong fit (student, wrong industry, no company)

Respond with ONLY valid JSON, no markdown:
{"score": <number>, "reason": "<one sentence>"}`;

  const response = await callClaudeWithRetry({
    prompt,
    maxTokens: 100,
    model: "claude-haiku-4-5",
  });

  try {
    const jsonMatch = response.match(/\{[^}]+\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: Number(parsed.score) || 50,
      reason: String(parsed.reason || "AI-scored"),
      shouldRespond: (Number(parsed.score) || 50) >= 40,
    };
  } catch {
    throw new Error("Failed to parse AI score response");
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function quickScoreLead(lead: SalesforceLeadWebhookPayload): Promise<LeadQualScore> {
  // No email = skip immediately
  if (!lead.Email) {
    return { score: 0, reason: "No email address", shouldRespond: false };
  }

  try {
    const result = await Promise.race([
      aiScore(lead),
      // Fallback: if AI takes >4s, just use rule-based
      new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
    ]);

    if (result !== null) {
      return result;
    }
    console.log("[LeadQualifier] AI timeout — using rule-based fallback");
  } catch (err) {
    console.warn("[LeadQualifier] AI scoring failed, using rules:", err instanceof Error ? err.message : err);
  }

  return ruleBasedScore(lead);
}
