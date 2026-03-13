/**
 * Handoff Agent
 * Post-call orchestrator: extracts BANT from transcript, scores product interest,
 * updates lead status to "qualified", pushes to Salesforce, and sends a
 * handoff summary email to the AE.
 *
 * Triggered manually from the lead detail panel OR automatically after a
 * call session is completed with a "qualified" disposition.
 */

import { storage } from '../storage.js';
import { extractBANTFromTranscript } from './bantExtraction.js';
import { handoverToSalesforce } from '../integrations/salesforceLeads.js';
import { callClaudeWithRetry } from './claudeClient.js';
import { getProductCatalogPrompt } from './productCatalog.js';
import { sendFeedbackEmail } from '../google/gmailClient.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HandoffInput {
  leadId: string;
  callSessionId?: string;          // if provided, extracts BANT from transcript
  aeEmail?: string;                // AE to notify
  pushToSalesforce?: boolean;      // default true if Salesforce is connected
  convertToOpportunity?: boolean;  // default false
  manualNotes?: string;            // optional SDR notes to include
}

export interface ProductInterest {
  productId: string;
  productName: string;
  interestLevel: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface HandoffResult {
  agent: 'handoff';
  leadId: string;
  companyName: string;
  contactName: string;
  // BANT
  budget: string | null;
  timeline: string | null;
  decisionMakers: string | null;
  needs: string[];
  bantConfidence: Record<string, string>;
  // Product interest
  productInterests: ProductInterest[];
  // Actions taken
  statusUpdated: boolean;
  salesforcePushed: boolean;
  salesforceId?: string;
  opportunityId?: string;
  emailSent: boolean;
  // Summary
  handoffSummary: string;
  durationMs: number;
}

// ─── Product interest extraction ─────────────────────────────────────────────

async function extractProductInterest(
  transcriptText: string,
  companyName: string,
  companyIndustry: string | null
): Promise<ProductInterest[]> {
  const prompt = `You are a sales analyst for Hawk Ridge Systems. Analyze this call transcript and identify which HRS products the prospect showed interest in.

${getProductCatalogPrompt()}

---
COMPANY: ${companyName}
INDUSTRY: ${companyIndustry || 'Unknown'}

TRANSCRIPT:
${transcriptText.slice(0, 5000)}

---
Based on the conversation, identify which products were mentioned or implied.
Return ONLY valid JSON array (no markdown):
[
  {
    "productId": <product id from catalog>,
    "productName": <product name>,
    "interestLevel": <"high"|"medium"|"low">,
    "evidence": <1 sentence quoting or paraphrasing what was said>
  }
]

Return empty array [] if no specific products were discussed.`;

  try {
    const text = await callClaudeWithRetry({ prompt, maxTokens: 600 });
    const clean = text.trim().replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Handoff summary generation ───────────────────────────────────────────────

async function generateHandoffSummary(params: {
  companyName: string;
  contactName: string;
  contactTitle: string | null;
  budget: string | null;
  timeline: string | null;
  decisionMakers: string | null;
  needs: string[];
  productInterests: ProductInterest[];
  manualNotes?: string;
}): Promise<string> {
  const prompt = `Write a concise AE handoff summary for this qualified lead. Use a professional but direct tone. Max 150 words.

Company: ${params.companyName}
Contact: ${params.contactName}${params.contactTitle ? ` (${params.contactTitle})` : ''}
Budget: ${params.budget || 'Not discussed'}
Timeline: ${params.timeline || 'Not discussed'}
Decision Makers: ${params.decisionMakers || 'Not identified'}
Key Needs: ${params.needs.slice(0, 3).join('; ') || 'See notes'}
Product Interest: ${params.productInterests.map(p => `${p.productName} (${p.interestLevel})`).join(', ') || 'General inquiry'}
${params.manualNotes ? `SDR Notes: ${params.manualNotes}` : ''}

Write the summary as a single paragraph the AE can read in 30 seconds before their first call.`;

  try {
    return await callClaudeWithRetry({ prompt, maxTokens: 250 });
  } catch {
    return `Qualified lead at ${params.companyName}. Contact: ${params.contactName}. ` +
      `Budget: ${params.budget || 'TBD'}. Timeline: ${params.timeline || 'TBD'}. ` +
      `Interested in: ${params.productInterests.map(p => p.productName).join(', ') || 'HRS products'}.`;
  }
}

// ─── Handoff email formatter ─────────────────────────────────────────────────

function formatHandoffEmailBody(params: {
  companyName: string;
  contactName: string;
  contactTitle: string | null;
  budget: string | null;
  timeline: string | null;
  decisionMakers: string | null;
  needs: string[];
  productInterests: ProductInterest[];
  handoffSummary: string;
  salesforceId?: string;
  manualNotes?: string;
}): string {
  const productRows = params.productInterests.length
    ? params.productInterests
        .map(
          p => `<tr>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${p.productName}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">
              <span style="background:${p.interestLevel === 'high' ? '#d1fae5' : p.interestLevel === 'medium' ? '#fef3c7' : '#f3f4f6'};
                color:${p.interestLevel === 'high' ? '#065f46' : p.interestLevel === 'medium' ? '#92400e' : '#374151'};
                padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:600;">
                ${p.interestLevel.toUpperCase()}
              </span>
            </td>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">${p.evidence}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="3" style="padding:12px;color:#9ca3af;text-align:center;">No specific products identified</td></tr>`;

  return `
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f9fafb; margin:0; padding:20px; color:#1f2937; }
    .container { max-width:660px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
    .header { background:#111827; color:#fff; padding:24px 32px; }
    .header h1 { margin:0; font-size:20px; font-weight:700; }
    .header .sub { color:#9ca3af; font-size:14px; margin-top:6px; }
    .section { padding:24px 32px; border-bottom:1px solid #f3f4f6; }
    .section h2 { margin:0 0 16px; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; }
    .bant-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .bant-item { background:#f9fafb; border-radius:8px; padding:12px 16px; }
    .bant-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#9ca3af; margin-bottom:4px; }
    .bant-value { font-size:14px; color:#111827; }
    .summary-box { background:#eff6ff; border-left:4px solid #3b82f6; padding:16px; border-radius:0 8px 8px 0; font-size:14px; line-height:1.7; color:#1e40af; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; padding:8px 12px; background:#f9fafb; font-size:12px; font-weight:700; text-transform:uppercase; color:#6b7280; border-bottom:2px solid #e5e7eb; }
    .footer { padding:20px 32px; background:#f9fafb; text-align:center; font-size:12px; color:#9ca3af; }
    .tag { display:inline-block; background:#e0e7ff; color:#3730a3; padding:3px 10px; border-radius:9999px; font-size:12px; font-weight:600; margin:2px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤝 Qualified Lead Handoff — ${params.companyName}</h1>
      <div class="sub">${params.contactName}${params.contactTitle ? ` · ${params.contactTitle}` : ''}</div>
    </div>

    <div class="section">
      <h2>AE Briefing</h2>
      <div class="summary-box">${params.handoffSummary}</div>
    </div>

    <div class="section">
      <h2>BANT</h2>
      <div class="bant-grid">
        <div class="bant-item">
          <div class="bant-label">Budget</div>
          <div class="bant-value">${params.budget || '<em style="color:#9ca3af">Not discussed</em>'}</div>
        </div>
        <div class="bant-item">
          <div class="bant-label">Timeline</div>
          <div class="bant-value">${params.timeline || '<em style="color:#9ca3af">Not discussed</em>'}</div>
        </div>
        <div class="bant-item">
          <div class="bant-label">Decision Makers</div>
          <div class="bant-value">${params.decisionMakers || '<em style="color:#9ca3af">Not identified</em>'}</div>
        </div>
        <div class="bant-item">
          <div class="bant-label">Key Needs</div>
          <div class="bant-value">${params.needs.slice(0, 3).join('; ') || '<em style="color:#9ca3af">See notes</em>'}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Product Interest</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Interest</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>${productRows}</tbody>
      </table>
    </div>

    ${params.manualNotes ? `
    <div class="section">
      <h2>SDR Notes</h2>
      <p style="font-size:14px;line-height:1.7;margin:0;">${params.manualNotes}</p>
    </div>` : ''}

    ${params.salesforceId ? `
    <div class="section" style="border-bottom:none;">
      <h2>CRM</h2>
      <p style="margin:0;font-size:14px;">Salesforce Lead ID: <strong>${params.salesforceId}</strong></p>
    </div>` : ''}

    <div class="footer">Powered by GameTime.ai · Hawk Ridge Systems</div>
  </div>
</body>
</html>`;
}

// ─── Main handoff function ────────────────────────────────────────────────────

export async function runHandoffAgent(input: HandoffInput): Promise<HandoffResult> {
  const startedAt = Date.now();

  const lead = await storage.getLead(input.leadId);
  if (!lead) throw new Error(`Lead ${input.leadId} not found`);

  // Step 1 — Extract BANT from transcript (if call session provided)
  let bant = {
    budget: lead.budget,
    timeline: lead.timeline,
    decisionMakers: lead.decisionMakers,
    needs: [] as string[],
    confidence: {} as Record<string, string>,
  };

  if (input.callSessionId) {
    try {
      const extracted = await extractBANTFromTranscript(input.callSessionId);
      bant = {
        budget: extracted.budget || lead.budget,
        timeline: extracted.timeline || lead.timeline,
        decisionMakers: extracted.decisionMakers || lead.decisionMakers,
        needs: extracted.needs || [],
        confidence: extracted.confidence || {},
      };
    } catch (err) {
      console.warn('[HandoffAgent] BANT extraction failed:', err);
    }
  }

  // Step 2 — Extract product interest from transcript
  let productInterests: ProductInterest[] = [];
  if (input.callSessionId) {
    try {
      const session = await storage.getCallSession(input.callSessionId);
      if (session?.transcriptText && session.transcriptText.length > 100) {
        productInterests = await extractProductInterest(
          session.transcriptText,
          lead.companyName,
          lead.companyIndustry
        );
      }
    } catch (err) {
      console.warn('[HandoffAgent] Product interest extraction failed:', err);
    }
  }

  // Step 3 — Generate handoff summary
  const handoffSummary = await generateHandoffSummary({
    companyName: lead.companyName,
    contactName: lead.contactName,
    contactTitle: lead.contactTitle,
    budget: bant.budget,
    timeline: bant.timeline,
    decisionMakers: bant.decisionMakers,
    needs: bant.needs,
    productInterests,
    manualNotes: input.manualNotes,
  });

  // Step 4 — Update lead status to "qualified" with BANT data
  let statusUpdated = false;
  try {
    await storage.updateLead(input.leadId, {
      status: 'qualified',
      budget: bant.budget || undefined,
      timeline: bant.timeline || undefined,
      decisionMakers: bant.decisionMakers || undefined,
      qualificationNotes: [
        handoffSummary,
        input.manualNotes ? `\nSDR Notes: ${input.manualNotes}` : '',
      ].filter(Boolean).join('\n'),
      buySignals: bant.needs.slice(0, 3).join('; ') || undefined,
      handedOffAt: new Date(),
      qualifiedAt: new Date(),
    });
    statusUpdated = true;
  } catch (err) {
    console.error('[HandoffAgent] Lead update failed:', err);
  }

  // Step 5 — Push to Salesforce (optional)
  let salesforcePushed = false;
  let salesforceId: string | undefined;
  let opportunityId: string | undefined;

  if (input.pushToSalesforce !== false) {
    try {
      const sfResult = await handoverToSalesforce(input.leadId, {
        accountExecutiveEmail: input.aeEmail,
        convertToOpportunity: input.convertToOpportunity ?? false,
      });
      if (sfResult.success) {
        salesforcePushed = true;
        salesforceId = sfResult.salesforceId;
        opportunityId = sfResult.opportunityId;
      }
    } catch (err) {
      // Salesforce not configured is not a fatal error
      console.warn('[HandoffAgent] Salesforce push skipped:', (err as Error).message);
    }
  }

  // Step 6 — Send handoff email to AE
  let emailSent = false;
  if (input.aeEmail) {
    try {
      const emailBody = formatHandoffEmailBody({
        companyName: lead.companyName,
        contactName: lead.contactName,
        contactTitle: lead.contactTitle,
        budget: bant.budget,
        timeline: bant.timeline,
        decisionMakers: bant.decisionMakers,
        needs: bant.needs,
        productInterests,
        handoffSummary,
        salesforceId,
        manualNotes: input.manualNotes,
      });

      await sendFeedbackEmail({
        to: input.aeEmail,
        subject: `[Handoff] ${lead.companyName} — ${lead.contactName} is ready for you`,
        body: emailBody,
      });
      emailSent = true;
      console.log(`[HandoffAgent] Handoff email sent to ${input.aeEmail}`);
    } catch (err) {
      console.warn('[HandoffAgent] Email send failed:', (err as Error).message);
    }
  }

  return {
    agent: 'handoff',
    leadId: input.leadId,
    companyName: lead.companyName,
    contactName: lead.contactName,
    budget: bant.budget,
    timeline: bant.timeline,
    decisionMakers: bant.decisionMakers,
    needs: bant.needs,
    bantConfidence: bant.confidence,
    productInterests,
    statusUpdated,
    salesforcePushed,
    salesforceId,
    opportunityId,
    emailSent,
    handoffSummary,
    durationMs: Date.now() - startedAt,
  };
}
