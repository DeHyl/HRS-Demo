/**
 * leadResponseEmailGenerator.ts
 * Generates personalized outreach emails for the Lead Response Engine.
 * Tone: consultive, human, NOT spammy.
 * Sender: GameTime Team | HawkRidge Systems
 */

import type { SalesforceLeadWebhookPayload } from "./quickLeadQualifier";
import { callClaudeWithRetry } from "./claudeClient";

export interface LeadResponseEmail {
  subject: string;
  body: string; // HTML
}

// ─── Industry pain point mapping ─────────────────────────────────────────────

const INDUSTRY_PAIN_POINTS: Record<string, string> = {
  manufacturing: "reducing design iteration cycles and getting to production faster",
  aerospace: "managing complex assemblies and maintaining AS9100/DO-178 compliance workflows",
  automotive: "accelerating vehicle component design and simulation-driven validation",
  "medical device": "navigating FDA design control requirements while keeping development on schedule",
  defense: "managing ITAR-compliant CAD workflows and large assembly performance",
  industrial: "standardizing design templates and reducing rework across engineering teams",
  electronics: "integrating ECAD/MCAD workflows for faster PCB enclosure development",
  robotics: "simulating mechanism motion and stress-testing designs before prototyping",
  architecture: "connecting 3D modeling to downstream manufacturing and fabrication",
};

function getPainPoint(industry: string): string {
  if (!industry) return "improving engineering design efficiency and reducing time-to-market";
  const lower = industry.toLowerCase();
  for (const [key, pain] of Object.entries(INDUSTRY_PAIN_POINTS)) {
    if (lower.includes(key)) return pain;
  }
  return "improving engineering design efficiency and reducing time-to-market";
}

// ─── Rule-based fallback email ────────────────────────────────────────────────

function buildFallbackEmail(lead: SalesforceLeadWebhookPayload): LeadResponseEmail {
  const firstName = lead.FirstName || "there";
  const company = lead.Company || "your company";
  const industry = lead.Industry || "";
  const title = lead.Title || "";
  const painPoint = getPainPoint(industry);

  const subject = `Quick question${firstName !== "there" ? `, ${firstName}` : ""} — ${company} + HRS`;

  const body = `
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 24px;">

<p>Hi ${firstName},</p>

<p>I came across ${company} and wanted to reach out — we work with ${industry ? `${industry} companies` : "engineering teams"} like yours on ${painPoint}.</p>

<p>HawkRidge Systems is the #1 SOLIDWORKS and CATIA reseller in North America. ${title ? `Given your role${title ? ` as ${title}` : ""}` : "Given your background"}, I'm curious: what's your current CAD/simulation stack, and where are the biggest bottlenecks slowing your team down?</p>

<p>Worth a 15-minute call to share what we're seeing with similar teams? No pitch — just want to understand your setup.</p>

<p style="margin-top: 24px;">Best,<br>
<strong>GameTime Team</strong><br>
HawkRidge Systems<br>
<a href="mailto:hawk.gametime@gmail.com">hawk.gametime@gmail.com</a></p>

</body></html>
`.trim();

  return { subject, body };
}

// ─── AI-generated email ───────────────────────────────────────────────────────

async function buildAiEmail(lead: SalesforceLeadWebhookPayload): Promise<LeadResponseEmail> {
  const firstName = lead.FirstName || "there";
  const company = lead.Company || "your company";
  const industry = lead.Industry || "engineering";
  const title = lead.Title || "";
  const painPoint = getPainPoint(industry);

  const prompt = `Write a brief, personalized B2B outreach email for this lead. Return ONLY valid JSON with "subject" and "body" keys — no markdown, no code fences.

Lead context:
- First name: ${firstName}
- Title: ${title || "unknown"}
- Company: ${company}
- Industry: ${industry}
- Key pain point for their industry: ${painPoint}

HRS context:
- HawkRidge Systems = #1 SOLIDWORKS + CATIA + 3D printing software reseller in North America
- We help engineering teams design faster, simulate better, and get to production with less rework
- Sender: hawk.gametime@gmail.com | "GameTime Team | HawkRidge Systems"

Rules:
- Subject: short, specific, NOT clickbait — mention company or firstName
- Body: 3 short paragraphs (2–3 sentences each)
  - Para 1: brief personal tie-in to their industry/role and what HRS does
  - Para 2: ask ONE specific question about their current design workflow or challenge
  - Para 3: light CTA — 15-min call, zero pressure language
- Tone: consultive, direct, human — like a smart colleague reaching out, NOT a cold sales email
- Close with: "GameTime Team | HawkRidge Systems | hawk.gametime@gmail.com"
- Body must be valid HTML (use <p> tags, no tables)
- Keep entire email under 200 words

Return JSON only: {"subject": "...", "body": "<html>...</html>"}`;

  const response = await callClaudeWithRetry({
    prompt,
    maxTokens: 600,
    model: "claude-haiku-4-5",
  });

  const jsonMatch = response.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.subject || !parsed.body) throw new Error("Missing subject or body in AI response");

  return {
    subject: String(parsed.subject),
    body: String(parsed.body),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateLeadResponseEmail(
  lead: SalesforceLeadWebhookPayload
): Promise<LeadResponseEmail> {
  try {
    const result = await Promise.race([
      buildAiEmail(lead),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
    ]);

    if (result !== null) return result;
    console.log("[EmailGen] AI timeout — using template fallback");
  } catch (err) {
    console.warn("[EmailGen] AI generation failed, using template:", err instanceof Error ? err.message : err);
  }

  return buildFallbackEmail(lead);
}
