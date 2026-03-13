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
    emailSent: false, // Teams/email integration placeholder
    handoffSummary,
    durationMs: Date.now() - startedAt,
  };
}
