/**
 * Prospector Agent
 * Finds NEW leads from scratch using Google (SerpAPI) + website scraping + LinkedIn.
 * Unlike the Dossier Agent (which researches a known lead), the Prospector
 * discovers companies that match the HRS ICP and inserts them into the leads DB.
 *
 * Pipeline per prospect:
 *   SerpAPI Google search → extract companies → scrape website → extract contact →
 *   scrubLead() ICP score → insert if fitScore >= minFitScore
 */

import { scrubLead } from './leadResearch.js';
import { scrapeCompanyWebsite } from './websiteScraper.js';
import { callClaudeWithRetry } from './claudeClient.js';
import pLimit from 'p-limit';

const SERP_API_KEY = process.env.SERP_API;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProspectSearchCriteria {
  industry: string;             // e.g. "Aerospace Manufacturing"
  location?: string;            // e.g. "California" or "United States"
  companySize?: string;         // e.g. "100-500 employees"
  contactTitle?: string;        // e.g. "Engineering Manager"
  keywords?: string[];          // additional search terms
  maxResults?: number;          // cap on leads to insert (default 20)
  minFitScore?: number;         // minimum score to save (default 55)
}

export interface ProspectResult {
  companyName: string;
  companyWebsite: string | null;
  companyIndustry: string;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedIn: string | null;
  fitScore: number;
  priority: 'hot' | 'warm' | 'cool' | 'cold';
  qualifies: boolean;
  reasoning: string;
  source: string;
}

export interface ProspectorRunResult {
  agent: 'prospector';
  criteria: ProspectSearchCriteria;
  discovered: number;
  qualified: number;
  inserted: number;
  skipped: number;
  durationMs: number;
  results: ProspectResult[];
}

// ─── SerpAPI helpers ─────────────────────────────────────────────────────────

async function googleSearch(query: string, numResults = 10): Promise<Array<{
  title: string;
  link: string;
  snippet: string;
}>> {
  if (!SERP_API_KEY) {
    console.warn('[Prospector] No SERP_API key — skipping Google search');
    return [];
  }

  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', SERP_API_KEY);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('num', String(numResults));

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`[Prospector] SerpAPI ${res.status}`);
      return [];
    }

    const data = await res.json();
    return (data.organic_results || []).map((r: { title?: string; link?: string; snippet?: string }) => ({
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
    }));
  } catch (err) {
    console.error('[Prospector] SerpAPI error:', err);
    return [];
  }
}

async function searchLinkedInCompanies(criteria: ProspectSearchCriteria): Promise<Array<{
  companyName: string;
  linkedInUrl: string;
  snippet: string;
}>> {
  const sizeHint = criteria.companySize ? ` ${criteria.companySize}` : '';
  const locationHint = criteria.location ? ` ${criteria.location}` : '';
  const keywordsHint = criteria.keywords?.length ? ` ${criteria.keywords.join(' ')}` : '';

  const query = `site:linkedin.com/company ${criteria.industry}${locationHint}${sizeHint}${keywordsHint} engineering`;

  const results = await googleSearch(query, 15);

  return results
    .filter(r => r.link.includes('linkedin.com/company/'))
    .map(r => {
      // Extract company name from LinkedIn URL or title
      const urlSlug = r.link.split('linkedin.com/company/')[1]?.split('/')[0] || '';
      const nameFromTitle = r.title.replace(/\s*[\|\-].*$/, '').trim();
      return {
        companyName: nameFromTitle || urlSlug.replace(/-/g, ' '),
        linkedInUrl: r.link,
        snippet: r.snippet,
      };
    })
    .slice(0, criteria.maxResults || 20);
}

async function searchGoogleCompanies(criteria: ProspectSearchCriteria): Promise<Array<{
  companyName: string;
  website: string | null;
  snippet: string;
}>> {
  const locationHint = criteria.location ? ` in ${criteria.location}` : '';
  const sizeHint = criteria.companySize ? ` ${criteria.companySize}` : '';
  const keywordsHint = criteria.keywords?.length ? ` ${criteria.keywords.join(' ')}` : '';
  const titleHint = criteria.contactTitle ? ` "${criteria.contactTitle}"` : '';

  const query = `${criteria.industry}${locationHint} company${sizeHint}${keywordsHint}${titleHint} -site:linkedin.com -site:indeed.com -site:glassdoor.com`;

  const results = await googleSearch(query, 15);

  return results
    .filter(r => r.link && !r.link.includes('linkedin.com') && !r.link.includes('indeed.com'))
    .map(r => {
      let domain: string | null = null;
      try {
        domain = new URL(r.link).hostname.replace(/^www\./, '');
      } catch { /* ignore */ }

      const nameFromTitle = r.title.replace(/\s*[\|\-].*$/, '').trim();
      return {
        companyName: nameFromTitle,
        website: domain ? `https://${domain}` : null,
        snippet: r.snippet,
      };
    })
    .slice(0, criteria.maxResults || 20);
}

// ─── Contact extraction ───────────────────────────────────────────────────────

interface ExtractedContact {
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedIn: string | null;
  companyIndustry: string | null;
  companySize: string | null;
  companyDescription: string | null;
}

async function extractContactFromWebsite(
  companyName: string,
  website: string,
  preferredTitle: string | undefined
): Promise<ExtractedContact> {
  const scraped = await scrapeCompanyWebsite(website);
  if (!scraped) {
    return {
      contactName: null, contactTitle: null, contactEmail: null,
      contactPhone: null, contactLinkedIn: null,
      companyIndustry: null, companySize: null, companyDescription: null,
    };
  }

  const titleHint = preferredTitle
    ? `Preferred contact title: "${preferredTitle}". If not found, pick the most senior engineering/technical leader.`
    : 'Pick the most senior engineering or operations leader you can find.';

  // Combine all scraped pages into usable text
  const pageText = [scraped.homepage, scraped.aboutPage, scraped.servicesPage, scraped.contactPage]
    .filter(Boolean).join('\n\n').slice(0, 4000);

  const prompt = `Extract contact and company info from this website content for ${companyName}.

${titleHint}

Website content:
${pageText}

Return ONLY valid JSON (no markdown):
{
  "contactName": <string or null>,
  "contactTitle": <string or null>,
  "contactEmail": <string or null>,
  "contactPhone": <string or null>,
  "contactLinkedIn": <LinkedIn profile URL or null>,
  "companyIndustry": <specific industry sub-vertical, e.g. "Aerospace Manufacturing" or null>,
  "companySize": <estimated headcount range e.g. "50-200" or null>,
  "companyDescription": <1-2 sentence description of what the company makes or does, or null>
}`;

  try {
    const text = await callClaudeWithRetry({ prompt, maxTokens: 400 });
    const clean = text.trim().replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(clean);
  } catch {
    return {
      contactName: null, contactTitle: null, contactEmail: null,
      contactPhone: null, contactLinkedIn: null,
      companyIndustry: null, companySize: null, companyDescription: null,
    };
  }
}

// ─── Dedup helper ─────────────────────────────────────────────────────────────

function normalizeCompanyName(name: string): string {
  return name.toLowerCase()
    .replace(/,?\s*(inc\.?|llc\.?|corp\.?|ltd\.?|company|co\.?|systems|technologies|solutions)$/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ─── Main prospector function ─────────────────────────────────────────────────

export async function runProspector(
  criteria: ProspectSearchCriteria,
  existingCompanyNames: string[] = []
): Promise<ProspectorRunResult> {
  const startedAt = Date.now();
  const maxResults = Math.min(criteria.maxResults || 20, 50);
  const minFitScore = criteria.minFitScore ?? 55;

  console.log(`[Prospector] Starting search: ${criteria.industry}${criteria.location ? ` in ${criteria.location}` : ''}`);

  // Step 1: Discover companies via Google + LinkedIn
  const [linkedInCompanies, googleCompanies] = await Promise.all([
    searchLinkedInCompanies(criteria),
    searchGoogleCompanies(criteria),
  ]);

  // Merge and dedup by normalized company name
  const existingNorm = new Set(existingCompanyNames.map(normalizeCompanyName));
  const seen = new Set<string>();
  const candidates: Array<{ companyName: string; website: string | null; snippet: string }> = [];

  for (const c of [...linkedInCompanies, ...googleCompanies]) {
    const norm = normalizeCompanyName(c.companyName);
    if (!norm || seen.has(norm) || existingNorm.has(norm)) continue;
    seen.add(norm);
    candidates.push({
      companyName: c.companyName,
      website: 'website' in c ? c.website : null,
      snippet: c.snippet,
    });
    if (candidates.length >= maxResults * 2) break; // gather 2x to account for disqualifications
  }

  console.log(`[Prospector] ${candidates.length} unique candidates found`);

  // Step 2: Enrich + scrub each candidate (bounded concurrency)
  const limit = pLimit(3);
  const enriched = await Promise.allSettled(
    candidates.slice(0, maxResults * 2).map(candidate =>
      limit(async (): Promise<ProspectResult> => {
        let contact: ExtractedContact = {
          contactName: null, contactTitle: null, contactEmail: null,
          contactPhone: null, contactLinkedIn: null,
          companyIndustry: criteria.industry, companySize: null, companyDescription: candidate.snippet,
        };

        // Try to enrich from website
        if (candidate.website) {
          try {
            contact = await extractContactFromWebsite(
              candidate.companyName,
              candidate.website,
              criteria.contactTitle
            );
          } catch (err) {
            console.warn(`[Prospector] Website scrape failed for ${candidate.companyName}:`, err);
          }
        }

        // Build a minimal Lead-shaped object for scrubLead()
        const leadForScrub = {
          id: 'prospect-temp',
          companyName: candidate.companyName,
          companyIndustry: contact.companyIndustry || criteria.industry,
          companySize: contact.companySize || null,
          contactName: contact.contactName || 'Unknown',
          contactTitle: contact.contactTitle || null,
          companyDescription: contact.companyDescription || candidate.snippet,
          source: 'ai-prospector',
          // Required Lead fields with safe defaults
          companyWebsite: candidate.website,
          contactEmail: contact.contactEmail || '',
          contactPhone: contact.contactPhone,
          contactLinkedIn: contact.contactLinkedIn,
          status: 'new',
          fitScore: null,
          priority: null,
          assignedSdrId: null,
          assignedAeId: null,
          qualificationNotes: null,
          buySignals: null,
          budget: null,
          timeline: null,
          decisionMakers: null,
          handedOffAt: null,
          handedOffBy: null,
          nextFollowUpAt: null,
          lastContactedAt: null,
          firstContactedAt: null,
          qualifiedAt: null,
          convertedAt: null,
          lostAt: null,
          salesforceId: null,
          salesforceLastSync: null,
          disqualificationReason: null,
          researchStatus: null,
          createdAt: new Date(),
        } as Parameters<typeof scrubLead>[0];

        const scrubResult = await scrubLead(leadForScrub);

        return {
          companyName: candidate.companyName,
          companyWebsite: candidate.website,
          companyIndustry: contact.companyIndustry || criteria.industry,
          contactName: contact.contactName,
          contactTitle: contact.contactTitle,
          contactEmail: contact.contactEmail,
          contactPhone: contact.contactPhone,
          contactLinkedIn: contact.contactLinkedIn,
          fitScore: scrubResult.fitScore,
          priority: scrubResult.priority,
          qualifies: scrubResult.qualifies,
          reasoning: scrubResult.reasoning,
          source: 'ai-prospector',
        };
      })
    )
  );

  const results: ProspectResult[] = enriched
    .filter((r): r is PromiseFulfilledResult<ProspectResult> => r.status === 'fulfilled')
    .map(r => r.value);

  const qualified = results.filter(r => r.qualifies && r.fitScore >= minFitScore);

  console.log(`[Prospector] ${results.length} enriched, ${qualified.length} qualify (score >= ${minFitScore})`);

  return {
    agent: 'prospector',
    criteria,
    discovered: candidates.length,
    qualified: qualified.length,
    inserted: 0, // caller handles DB insertion
    skipped: results.length - qualified.length,
    durationMs: Date.now() - startedAt,
    results: qualified,
  };
}
