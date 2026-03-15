/**
 * emailHandoffAgent.ts
 * Generates an AE handoff package when Robin detects a high-intent lead.
 * Sends a structured handoff email to the assigned AE.
 * Template is read from config/handoff-template.md (editable by Brandon).
 */

import { callClaudeWithRetry } from "./claudeClient.js";
import { sendFeedbackEmail } from "../google/gmailClient.js";
import { EmailAnalysis } from "./inboundEmailAgent.js";

async function loadHandoffTemplate(): Promise<string> {
  // 1. Check DB first (editable from Robin Settings UI)
  try {
    const { storage } = await import("../storage.js");
    const config = await storage.getRobinConfig();
    if (config?.handoffTemplate) return config.handoffTemplate;
  } catch {}
  // 2. Fall back to built-in default
  return DEFAULT_HANDOFF_TEMPLATE;
}

const DEFAULT_HANDOFF_TEMPLATE = `# HRS Lead Handoff — {{contactName}} at {{companyName}}

**Handed off by:** Robin (AI Sales Intelligence)
**Date:** {{date}}
**Thread subject:** {{subject}}

## Contact
- Name: {{contactName}}
- Email: {{contactEmail}}
- Company: {{companyName}}
- Engagement Score: {{engagementScore}}/5

## BANT Summary
- **Budget:** {{budget}}
- **Authority:** {{authority}}
- **Need:** {{need}}
- **Timeline:** {{timeline}}

## Products of Interest
{{products}}

## Key Questions Asked
{{questions}}

## Urgency Signals
{{urgencySignals}}

## Conversation Summary
{{summary}}

## Robin's Recommended Next Step
{{nextStep}}

## Full Thread
{{threadHistory}}
`;

export interface HandoffInput {
  analysis: EmailAnalysis;
  subject: string;
  priorMessages?: Array<{ from: string; body: string; date: string }>;
  aeEmail: string;
  aeName?: string;
}

export async function sendHandoffToAE(input: HandoffInput): Promise<void> {
  const { analysis, subject, priorMessages = [], aeEmail, aeName } = input;

  // Use Claude to extract BANT and generate summary
  const extractionPrompt = `You are summarizing a sales lead for an Account Executive handoff at Hawk Ridge Systems.

Lead: ${analysis.senderName} at ${analysis.senderCompany} (${analysis.senderEmail})
Engagement Score: ${analysis.engagementScore}/5
Products asked about: ${analysis.productsAsked.join(", ")}
Questions asked: ${analysis.questionsAsked.join(" | ")}
Urgency signals: ${analysis.urgencySignals.join(", ")}
Escalation reason: ${analysis.escalationReason || "High engagement score"}

Thread history (${priorMessages.length} prior messages):
${priorMessages.map(m => `[${m.date}] ${m.from}: ${m.body.slice(0, 400)}`).join("\n---\n")}

Return JSON only:
{
  "budget": "extracted budget or 'Not specified'",
  "authority": "who is the decision maker based on context",
  "need": "core business need in 1-2 sentences",
  "timeline": "extracted timeline or 'Not specified'",
  "summary": "2-3 sentence summary of the conversation so far",
  "nextStep": "specific recommended next step for the AE (e.g. 'Schedule 30-min technical demo of SOLIDWORKS PDM Professional with IT stakeholder')"
}`;

  let bant: any = {};
  try {
    const raw = await callClaudeWithRetry({ prompt: extractionPrompt, maxTokens: 800 });
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    bant = JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || "{}");
  } catch {
    bant = {
      budget: "Not extracted",
      authority: analysis.senderName,
      need: analysis.questionsAsked.join("; "),
      timeline: analysis.urgencySignals.join("; ") || "Not specified",
      summary: `${analysis.senderName} at ${analysis.senderCompany} reached out about ${analysis.productsAsked.join(", ")}.`,
      nextStep: "Follow up within 24 hours with product demo offer",
    };
  }

  const template = await loadHandoffTemplate();
  const threadHistory = priorMessages.length > 0
    ? priorMessages.map(m => `[${m.date}] ${m.from}:\n${m.body}`).join("\n\n---\n\n")
    : "(first contact — no prior thread)";

  const emailBody = template
    .replace(/{{contactName}}/g, analysis.senderName || "Unknown")
    .replace(/{{companyName}}/g, analysis.senderCompany || "Unknown")
    .replace(/{{contactEmail}}/g, analysis.senderEmail)
    .replace(/{{date}}/g, new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }))
    .replace(/{{subject}}/g, subject)
    .replace(/{{engagementScore}}/g, String(analysis.engagementScore))
    .replace(/{{budget}}/g, bant.budget || "Not specified")
    .replace(/{{authority}}/g, bant.authority || analysis.senderName)
    .replace(/{{need}}/g, bant.need || "See questions below")
    .replace(/{{timeline}}/g, bant.timeline || "Not specified")
    .replace(/{{products}}/g, analysis.productsAsked.map(p => `- ${p}`).join("\n") || "- Not specified")
    .replace(/{{questions}}/g, analysis.questionsAsked.map(q => `- ${q}`).join("\n") || "- See thread")
    .replace(/{{urgencySignals}}/g, analysis.urgencySignals.map(s => `- ${s}`).join("\n") || "- None detected")
    .replace(/{{summary}}/g, bant.summary || "")
    .replace(/{{nextStep}}/g, bant.nextStep || "")
    .replace(/{{threadHistory}}/g, threadHistory);

  // Convert markdown to simple HTML
  const htmlBody = emailBody
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");

  await sendFeedbackEmail({
    to: aeEmail,
    subject: `🔥 HRS Lead Handoff: ${analysis.senderName} at ${analysis.senderCompany} (Score ${analysis.engagementScore}/5)`,
    body: htmlBody,
  });

  console.log(`[HandoffAgent] ✅ Handoff email sent to AE ${aeEmail} for ${analysis.senderEmail}`);
}
