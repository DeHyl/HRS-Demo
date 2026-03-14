/**
 * Inbound Email Agent — Robin
 * Analyzes inbound prospect emails, classifies intent, drafts product-specific
 * responses using HRS product knowledge, and scores engagement.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getProductCatalogPrompt } from "./productCatalog.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface InboundEmailInput {
  from: string;    // "Brandon Zahn <brandonz@hawkridgesys.com>"
  subject: string;
  body: string;
  receivedAt?: Date;
}

export interface EmailAnalysis {
  senderName: string;
  senderEmail: string;
  senderCompany: string;
  senderDomain: string;
  productsAsked: string[];
  questionsAsked: string[];
  buyerStage: "awareness" | "consideration" | "decision";
  engagementScore: number;  // 1–5
  intent: string;           // "pricing inquiry" | "product comparison" | etc.
  urgencySignals: string[];
  suggestedResponse: string;
  escalateToHuman: boolean;
  escalationReason?: string;
}

// Pricing reference for response generation
const PRICING_GUIDANCE = `
PRICING GUIDANCE — use real ranges when pricing is asked (never dodge):
- SOLIDWORKS Standard: ~$4,000 perpetual or ~$1,800/yr subscription
- SOLIDWORKS Professional: ~$5,500–$6,500 perpetual or ~$2,500–$2,800/yr
- SOLIDWORKS Premium: ~$7,500–$8,500 perpetual or ~$3,200–$3,600/yr
- SOLIDWORKS Simulation (standalone): $3,000–$8,000 depending on tier
- SOLIDWORKS PDM Professional: ~$4,500/user (server + CAL)
- CAMWorks: ~$5,000–$12,000 depending on axis count
- DriveWorks Pro: custom quote based on # of design rules
- Markforged Onyx One (desktop composite): ~$4,000
- Markforged Mark Two (continuous fiber): ~$13,500
- Markforged X7 (industrial): ~$69,000
- Markforged Metal X: ~$99,000 (system + wash + sinter)
- Formlabs Form 4: ~$4,500 | Form 4L: ~$9,999
- HP Jet Fusion 5200: ~$350,000
- Artec Leo: ~$29,000 | EVA: ~$15,000 | Spider II: ~$25,000
- Geomagic Design X: ~$12,000 | Control X: ~$10,000
- Training (SOLIDWORKS Essentials, 3 days): ~$1,500/person
- Subscription vs. perpetual: subscriptions include maintenance; perpetual has annual maintenance ~18–20% of list

Always mention: volume discounts for 5+ seats, lease/finance available through HRS Capital,
and a 30-day ROI benchmark session to show total cost vs. current workflow.
`;

export async function analyzeInboundEmail(input: InboundEmailInput): Promise<EmailAnalysis> {
  const catalogPrompt = getProductCatalogPrompt();

  const prompt = `You are Robin, an AI sales assistant for Hawk Ridge Systems (HRS) — North America's #1 SOLIDWORKS reseller.

You have received an inbound email from a prospect. Your job:
1. Parse who is writing and what they need
2. Extract every specific question they asked (verbatim or close to it)
3. Score their engagement (1=cold/just browsing, 5=hot/ready to buy)
4. Decide if a human SDR should be looped in immediately
5. Draft a professional, product-specific response that:
   - Answers EVERY question directly — never dodge or redirect to "book a demo" to avoid answering
   - Demonstrates deep HRS product knowledge (SOLIDWORKS, CATIA, Formlabs, Markforged, Artec, CAMWorks, etc.)
   - When pricing is asked: give real ranges from the PRICING GUIDANCE below
   - Asks exactly 1–2 targeted qualifying questions (not generic ones)
   - Is concise and direct (3–5 short paragraphs max)
   - Does NOT use overly enthusiastic language ("Wow!", "Great question!", "Absolutely!")
   - Signs as: "Robin | HRS Sales Intelligence\\nHawk Ridge Systems"

${catalogPrompt}

${PRICING_GUIDANCE}

---
INBOUND EMAIL:
From: ${input.from}
Subject: ${input.subject || "(no subject)"}
Body:
${input.body}
---

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "senderName": "full name from signature or From header",
  "senderEmail": "email address only",
  "senderCompany": "company name from signature, email domain, or context",
  "senderDomain": "domain part of email (e.g. hawkridgesys.com)",
  "productsAsked": ["only products they explicitly mentioned by name"],
  "questionsAsked": ["exact questions extracted from the email"],
  "buyerStage": "awareness | consideration | decision",
  "engagementScore": 1,
  "intent": "short phrase: pricing inquiry / product comparison / demo request / technical question / general inquiry / competitive evaluation",
  "urgencySignals": ["any signals suggesting timeline, budget cycle, or decision pressure"],
  "suggestedResponse": "the full plain-text email body response",
  "escalateToHuman": false,
  "escalationReason": "reason if escalateToHuman is true, otherwise omit this field"
}

Escalate to human when: engagementScore >= 4, OR they mention a budget, OR they mention a specific timeline, OR they ask to see a demo.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Robin AI returned no valid JSON. Raw: ${text.substring(0, 300)}`);
  }

  return JSON.parse(jsonMatch[0]) as EmailAnalysis;
}
