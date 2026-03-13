import type { Lead, InsertResearchPacket } from "@shared/schema";
import { researchLeadOnX, formatXIntel, type XIntelResult } from "./xResearch";
import { gatherCompanyHardIntel, formatCompanyHardIntel, type CompanyHardIntel } from "./companyHardIntel";
import { HAWK_RIDGE_PRODUCTS, getProductCatalogPrompt, matchProductsToLead } from "./productCatalog";
import {
  gatherCompanyIntel,
  researchContactLinkedIn as scrapeContactLinkedIn,
  formatScrapedContentForPrompt,
  extractPhoneFromScrapedContent,
  type ScrapedIntel,
  type ContactLinkedInData,
} from "./websiteScraper";
import { getKnowledgebaseContent, getLeadScoringParameters } from "../google/driveClient";
import { callClaudeWithRetry, extractJsonFromResponse, getClaudeClient } from "./claudeClient";
import {
  calculateFitScorePenalties,
  applyScorePenalties,
  formatPenaltyBreakdown,
  determinePriority,
  normalizeConfidenceAssessment,
  extractString,
  extractArray,
} from "./helpers/leadScoringHelpers";
import { isBrowserlessConfigured } from "./browserlessClient.js";
import {
  scrapeLinkedInCompany,
  scrapeLinkedInProfile,
  scrapeCompanyJobs,
  scrapeCompanyWebsite,
  formatLinkedInCompanyData,
  formatLinkedInProfileData,
  formatJobPostingsData,
  formatCompanyWebsiteData,
  type LinkedInCompanyData,
  type LinkedInProfileData,
  type JobPostingsData,
  type CompanyWebsiteData,
} from "./scrapers/index.js";

// Research mode options
export interface ResearchOptions {
  mode: 'fast' | 'deep';
  sources?: {
    linkedInCompany?: boolean;
    linkedInProfile?: boolean;
    companyWebsite?: boolean;
    jobPostings?: boolean;
    news?: boolean;
  };
}

// Deep research data gathered via Browserless
export interface DeepResearchData {
  linkedInCompany: LinkedInCompanyData | null;
  linkedInProfile: LinkedInProfileData | null;
  jobPostings: JobPostingsData | null;
  websiteDeep: CompanyWebsiteData | null;
}

const BSA_SOLUTIONS_CONTEXT = getProductCatalogPrompt();

export interface ProductMatch {
  productId: string;
  productName: string;
  category: string;
  matchScore: number;
  rationale: string;
  valueProposition: string;
}

export interface PainPoint {
  pain: string;
  severity: "high" | "medium" | "low";
  bsaSolution: string;
}

export interface CareerHistoryItem {
  title: string;
  company: string;
  duration: string;
  relevance: string;
}

export interface ConfidenceAssessment {
  overall: "high" | "medium" | "low";
  companyInfoConfidence: "high" | "medium" | "low";
  contactInfoConfidence: "high" | "medium" | "low";
  reasoning: string;
  warnings: string[];
}

export interface LeadDossier {
  companySummary: string;
  companyNews: string[];
  painPoints: PainPoint[];
  productMatches: ProductMatch[];
  techStackIntel: string[];
  buyingTriggers: string[];
  
  contactBackground: string;
  careerHistory: CareerHistoryItem[];
  professionalInterests: string[];
  decisionMakingStyle: string;
  
  commonGround: string[];
  openingLine: string;
  talkTrack: string[];
  discoveryQuestions: string[];
  objectionHandles: Array<{ objection: string; response: string }>;
  theAsk: string;
  
  fitScore: number;
  fitScoreBreakdown: string;
  priority: "hot" | "warm" | "cool" | "cold";
  
  sources: string;
  linkedInUrl?: string;
  phoneNumber?: string;
  jobTitle?: string;
  companyWebsite?: string;
  companyAddress?: string;
  
  confidenceAssessment?: ConfidenceAssessment;
}

export interface LinkedInProfile {
  profileUrl?: string;
  headline?: string;
  currentPosition?: {
    title?: string;
    company?: string;
  };
  error?: string;
}

function formatContactLinkedInAsProfile(data: ContactLinkedInData | null): LinkedInProfile {
  if (!data) {
    return { error: "LinkedIn profile not found" };
  }
  return {
    profileUrl: data.linkedInUrl || undefined,
    headline: data.headline || undefined,
    currentPosition: {
      title: data.currentTitle || undefined,
      company: data.currentCompany || undefined,
    },
  };
}

export function formatLinkedInIntel(profile: LinkedInProfile): string {
  if (profile.error) {
    return `LinkedIn: ${profile.error}`;
  }
  const parts: string[] = [];
  if (profile.profileUrl) parts.push(`Profile: ${profile.profileUrl}`);
  if (profile.headline) parts.push(`Headline: ${profile.headline}`);
  if (profile.currentPosition?.title) parts.push(`Title: ${profile.currentPosition.title}`);
  if (profile.currentPosition?.company) parts.push(`Company: ${profile.currentPosition.company}`);
  return parts.length > 0 ? parts.join("\n") : "No LinkedIn data available";
}

interface PreScrapedData {
  scrapedIntel: ScrapedIntel;
  contactLinkedIn: ContactLinkedInData | null;
  companyHardIntel: CompanyHardIntel;
  xIntel: XIntelResult;
  knowledgeBase: string;
  scoringParams: string;
  deepResearch?: DeepResearchData;
  researchMode?: 'fast' | 'deep';
}

async function gatherAllIntelInParallel(lead: Lead): Promise<PreScrapedData> {
  console.log(`[LeadResearch] Starting PARALLEL pre-fetch for ${lead.contactName} at ${lead.companyName}`);
  
  const [
    scrapedIntel,
    contactLinkedIn,
    companyHardIntel,
    xIntel,
    knowledgeBase,
    scoringParams
  ] = await Promise.all([
    gatherCompanyIntel(lead.companyName, lead.companyWebsite || null),
    scrapeContactLinkedIn(lead.contactName, lead.companyName, lead.contactEmail),
    gatherCompanyHardIntel(lead).catch((err) => {
      console.error(`[LeadResearch] CompanyHardIntel failed for ${lead.companyName}:`, err.message);
      return { keyExecutives: [], competitors: [], recentNews: [], certifications: [], techStack: [], error: err.message } as CompanyHardIntel;
    }),
    researchLeadOnX(lead).catch((err) => {
      console.error(`[LeadResearch] X research failed for ${lead.contactName}:`, err.message);
      return {
        xHandle: null, profileUrl: null, bio: null, followerCount: null,
        recentPosts: [], conversationStarters: [], industryTrends: [], hashtags: [],
        engagementStyle: "", professionalTone: "", topicsOfInterest: [],
        companyMentions: [], recentNews: [], error: err.message
      } as XIntelResult;
    }),
    getKnowledgebaseContent().catch(() => ""),
    getLeadScoringParameters().catch(() => "")
  ]);
  
  console.log(`[LeadResearch] Pre-fetch complete. Website: ${!!scrapedIntel.website}, LinkedIn contact: ${!!contactLinkedIn}, LinkedIn company: ${!!scrapedIntel.linkedInCompany}`);

  return {
    scrapedIntel,
    contactLinkedIn,
    companyHardIntel,
    xIntel,
    knowledgeBase,
    scoringParams
  };
}

/**
 * Gather deep research data using Browserless.io scrapers
 * This provides richer intelligence but takes longer (30-60 seconds)
 */
async function gatherDeepResearchData(
  lead: Lead,
  sources: ResearchOptions['sources'] = {}
): Promise<DeepResearchData> {
  console.log(`[LeadResearch] Starting DEEP research for ${lead.contactName} at ${lead.companyName}`);

  if (!isBrowserlessConfigured()) {
    console.log('[LeadResearch] Browserless not configured, skipping deep research');
    return {
      linkedInCompany: null,
      linkedInProfile: null,
      jobPostings: null,
      websiteDeep: null,
    };
  }

  const deepTasks: Promise<void>[] = [];
  const results: DeepResearchData = {
    linkedInCompany: null,
    linkedInProfile: null,
    jobPostings: null,
    websiteDeep: null,
  };

  // LinkedIn Company scraping
  if (sources.linkedInCompany !== false) {
    const companyLinkedIn = `https://www.linkedin.com/company/${lead.companyName.toLowerCase().replace(/\s+/g, '-')}/`;

    deepTasks.push(
      scrapeLinkedInCompany(companyLinkedIn)
        .then((result) => {
          if (result.data) {
            results.linkedInCompany = result.data;
            console.log(`[LeadResearch] LinkedIn company scraped: ${result.data.name}`);
          } else if (result.error) {
            console.error(`[LeadResearch] LinkedIn company scrape failed: ${result.error}`);
          }
        })
        .catch((err) => {
          console.error(`[LeadResearch] LinkedIn company scrape error: ${err.message}`);
        })
    );
  }

  // LinkedIn Profile scraping
  if (sources.linkedInProfile !== false && lead.contactLinkedIn) {
    deepTasks.push(
      scrapeLinkedInProfile(lead.contactLinkedIn)
        .then((result) => {
          if (result.data) {
            results.linkedInProfile = result.data;
            console.log(`[LeadResearch] LinkedIn profile scraped: ${result.data.name}`);
          } else if (result.error) {
            console.error(`[LeadResearch] LinkedIn profile scrape failed: ${result.error}`);
          }
        })
        .catch((err) => {
          console.error(`[LeadResearch] LinkedIn profile scrape error: ${err.message}`);
        })
    );
  }

  // Company website deep scraping
  if (sources.companyWebsite !== false && lead.companyWebsite) {
    deepTasks.push(
      scrapeCompanyWebsite(lead.companyWebsite)
        .then((result) => {
          if (result.data) {
            results.websiteDeep = result.data;
            console.log(`[LeadResearch] Website deep scraped: ${result.data.url}`);
          } else if (result.error) {
            console.error(`[LeadResearch] Website deep scrape failed: ${result.error}`);
          }
        })
        .catch((err) => {
          console.error(`[LeadResearch] Website deep scrape error: ${err.message}`);
        })
    );
  }

  // Job postings scraping
  if (sources.jobPostings !== false) {
    deepTasks.push(
      scrapeCompanyJobs(lead.companyName)
        .then((result) => {
          if (result.data) {
            results.jobPostings = result.data;
            console.log(`[LeadResearch] Job postings scraped: ${result.data.totalOpenings} jobs`);
          } else if (result.error) {
            console.error(`[LeadResearch] Job postings scrape failed: ${result.error}`);
          }
        })
        .catch((err) => {
          console.error(`[LeadResearch] Job postings scrape error: ${err.message}`);
        })
    );
  }

  // Execute all deep scrapes in parallel
  await Promise.allSettled(deepTasks);

  const successCount = [
    results.linkedInCompany,
    results.linkedInProfile,
    results.jobPostings,
    results.websiteDeep,
  ].filter(Boolean).length;

  console.log(`[LeadResearch] Deep research complete. ${successCount}/4 sources gathered`);

  return results;
}

/**
 * Format deep research data for inclusion in Claude prompt
 */
function formatDeepResearchForPrompt(data: DeepResearchData): string {
  const sections: string[] = [];

  if (data.linkedInCompany) {
    sections.push('## DEEP RESEARCH: LinkedIn Company Data (via Browserless)');
    sections.push(formatLinkedInCompanyData(data.linkedInCompany));
    sections.push('');
  }

  if (data.linkedInProfile) {
    sections.push('## DEEP RESEARCH: LinkedIn Profile Data (via Browserless)');
    sections.push(formatLinkedInProfileData(data.linkedInProfile));
    sections.push('');
  }

  if (data.jobPostings && data.jobPostings.totalOpenings > 0) {
    sections.push('## DEEP RESEARCH: Job Postings Analysis (via Browserless)');
    sections.push(formatJobPostingsData(data.jobPostings));
    sections.push('');
  }

  if (data.websiteDeep) {
    sections.push('## DEEP RESEARCH: Website Deep Scrape (via Browserless)');
    sections.push(formatCompanyWebsiteData(data.websiteDeep));
    sections.push('');
  }

  return sections.join('\n');
}

export async function generateLeadDossier(lead: Lead, preScraped?: PreScrapedData): Promise<LeadDossier> {
  console.log(`[LeadResearch] generateLeadDossier called for ${lead.contactName}`);
  
  let scraped = preScraped;
  if (!scraped) {
    scraped = await gatherAllIntelInParallel(lead);
  }
  
  const scrapedContent = formatScrapedContentForPrompt(scraped.scrapedIntel);
  const phoneFromScrape = extractPhoneFromScrapedContent(scraped.scrapedIntel);
  
  let contactLinkedInSection = "";
  if (scraped.contactLinkedIn) {
    contactLinkedInSection = `
## CONTACT LINKEDIN DATA:
- LinkedIn URL: ${scraped.contactLinkedIn.linkedInUrl || "Not found"}
- Headline: ${scraped.contactLinkedIn.headline || "Unknown"}
- Current Title: ${scraped.contactLinkedIn.currentTitle || "Unknown"}
- Current Company: ${scraped.contactLinkedIn.currentCompany || "Unknown"}
- Location: ${scraped.contactLinkedIn.location || "Unknown"}
- Summary: ${scraped.contactLinkedIn.summary || "Not available"}
- Experience: ${scraped.contactLinkedIn.experience?.map(e => `${e.title} at ${e.company} (${e.duration})`).join("; ") || "Not available"}
- Education: ${scraped.contactLinkedIn.education?.join(", ") || "Not available"}
- Skills: ${scraped.contactLinkedIn.skills?.slice(0, 10).join(", ") || "Not available"}`;
  }
  
  let companyHardIntelSection = "";
  if (scraped.companyHardIntel && !scraped.companyHardIntel.error) {
    const chi = scraped.companyHardIntel;
    companyHardIntelSection = `
## COMPANY HARD INTEL (verified data):
- Employee Count: ${chi.employeeCount || "Unknown"}
- Revenue: ${chi.revenue || "Unknown"}
- Headquarters: ${chi.headquarters || "Unknown"}
- Founded: ${chi.founded || "Unknown"}
- Stock Info: ${chi.stockInfo || "Private"}
- Funding: ${chi.fundingInfo || "Not available"}
- Tech Stack: ${chi.techStack?.join(", ") || "Unknown"}
- Certifications: ${chi.certifications?.join(", ") || "None found"}
- Competitors: ${chi.competitors?.join(", ") || "Unknown"}
- Key Executives: ${chi.keyExecutives?.map(e => `${e.name} (${e.title})`).join(", ") || "Unknown"}
- Recent News: ${chi.recentNews?.slice(0, 3).join("; ") || "None found"}`;
  }
  
  const knowledgeBaseSection = scraped.knowledgeBase ? `
## HAWK RIDGE KNOWLEDGE BASE (Use this for accurate product info):
${scraped.knowledgeBase.substring(0, 12000)}` : "";

  const scoringSection = scraped.scoringParams ? `
## LEAD SCORING PARAMETERS (Use these criteria):
${scraped.scoringParams.substring(0, 4000)}` : "";

  // Deep research section (only if deep mode was used)
  const deepResearchSection = scraped.deepResearch ? formatDeepResearchForPrompt(scraped.deepResearch) : "";
  const researchModeNote = scraped.researchMode === 'deep'
    ? "\n\n🔬 RESEARCH MODE: DEEP - Enhanced intelligence gathered via headless browser scraping. Use this additional data to provide more detailed insights.\n"
    : "";

  const prompt = `You are an expert B2B sales intelligence analyst preparing a COMPREHENSIVE dossier for a sales call to sell BSA Solutions services.${researchModeNote}

${BSA_SOLUTIONS_CONTEXT}

## LEAD INFORMATION:
- Contact Name: ${lead.contactName}
- Job Title: ${lead.contactTitle || "Unknown"}
- Company: ${lead.companyName}
- Industry: ${lead.companyIndustry || "Unknown"}
- Company Size: ${lead.companySize || "Unknown"}
- Website: ${lead.companyWebsite || "Unknown"}
- LinkedIn: ${lead.contactLinkedIn || "Not provided"}
- Email Domain: ${lead.contactEmail.split("@")[1]}

=== PRE-SCRAPED INTELLIGENCE (USE THIS DATA) ===

${scrapedContent}
${contactLinkedInSection}
${companyHardIntelSection}
${knowledgeBaseSection}
${scoringSection}

${deepResearchSection}

=== END PRE-SCRAPED INTELLIGENCE ===

CRITICAL: Base your company summary and contact background on the ACTUAL SCRAPED CONTENT above. 
Do NOT say "Unable to find information" or "Research pending" if website, LinkedIn, or hard intel data is provided above - USE THAT DATA.
If the scraped content contains information about the company, products, services, or contact - incorporate it into your analysis.

You may use web search to find additional recent news and to supplement the pre-scraped data, but the pre-scraped data should be your PRIMARY source.

Return a JSON object with these EXACT keys:

{
  "companySummary": "2-3 paragraph detailed overview based on the SCRAPED CONTENT above - what this company does, their products/services, market position, and recent developments",
  
  "companyNews": [
    "Recent news item 1 with date if known",
    "Recent news item 2",
    "Product launches, funding, expansions, etc."
  ],
  
  "painPoints": [
    {"pain": "Specific challenge they face based on their industry/size", "severity": "high", "bsaSolution": "Dedicated offshore team"},
    {"pain": "Another pain point", "severity": "medium", "bsaSolution": "Finance and Accounting Support"},
    {"pain": "Third pain point", "severity": "low", "bsaSolution": "IT and Engineering Specialists"}
  ],
  
  "productMatches": [
    {"productId": "customer-support-team", "productName": "Customer Support Team", "category": "Customer Experience", "matchScore": 90, "rationale": "Why this service fits their needs", "valueProposition": "How it will help them specifically"},
    {"productId": "virtual-assistant-team", "productName": "Virtual Assistant Team", "category": "Administrative Support", "matchScore": 85, "rationale": "Why VAs would help", "valueProposition": "Specific value"}
  ],

  "techStackIntel": [
    "Current tools they use for operations",
    "Support/helpdesk systems (Zendesk, Intercom, etc.)",
    "Project management approach",
    "Other relevant operational technology"
  ],
  
  "buyingTriggers": [
    "Why they would buy NOW - be specific",
    "Recent event that creates urgency",
    "Business pressure or deadline"
  ],
  
  "contactBackground": "2-3 paragraphs about this person based on the CONTACT LINKEDIN DATA above - their career path, expertise, and what drives them",
  
  "careerHistory": [
    {"title": "Current Title", "company": "Current Company", "duration": "2 years", "relevance": "Why this experience matters for our conversation"},
    {"title": "Previous Title", "company": "Previous Company", "duration": "3 years", "relevance": "Relevant experience"}
  ],
  
  "professionalInterests": ["Operational efficiency", "Team scaling", "Cost optimization", "specific interests based on their role"],
  
  "decisionMakingStyle": "How this person likely makes decisions based on their role and background",
  
  "commonGround": [
    "Specific conversation starter based on their background",
    "Shared interest or connection point",
    "Reference to their work or company achievement"
  ],
  
  "openingLine": "A personalized 2-3 sentence opener that references something SPECIFIC about them or their company from the scraped data. Make it conversational.",
  
  "talkTrack": [
    "Key value proposition 1 tailored to their situation",
    "Key value proposition 2",
    "Key value proposition 3"
  ],
  
  "discoveryQuestions": [
    "Strategic question 1 to uncover needs",
    "Question 2 about current challenges",
    "Question 3 about decision process",
    "Question 4 about timeline",
    "Question 5 about budget/priorities"
  ],
  
  "objectionHandles": [
    {"objection": "We've had bad experiences with outsourcing", "response": "Specific response about BSA's Great Place to Work certification and quality focus"},
    {"objection": "Budget is tight", "response": "ROI-focused response highlighting 60-70% cost savings"},
    {"objection": "Concerned about communication/time zones", "response": "Response about 95% English proficiency and flexible coverage options"},
    {"objection": "Need to involve others", "response": "Champion enablement response with case studies and references"}
  ],
  
  "theAsk": "The specific next step to propose based on their likely readiness and situation",
  
  "fitScore": 0-100 STRICT SCORING (follow Lead Scoring Parameters doc if provided above):
    - Industry fit (25 pts max): E-commerce/SaaS/Tech = 20-25, Professional Services/Healthcare = 15-20, Other industries = 5-10
    - Company size (20 pts max): 50-500 employees = 20, 10-49 (growing) = 15, 501-2000 = 12, <10 or unknown = 0-5
    - Pain signals (25 pts max): Clear scaling/cost/hiring pain = 20-25, Implied operational challenges = 10-15, No signals = 0-5
    - Outsourcing readiness (15 pts max): Currently outsourcing or expressed interest = 12-15, Open to it = 5-8, No indication = 0-3
    - Buying triggers (15 pts max): Active hiring/scaling/cost pressure = 12-15, General growth = 5-8, No triggers = 0-3
    
    PENALTIES (subtract from total):
    - Gmail/personal email with unknown company: -30 points (likely not a real business lead)
    - No company website found: -15 points
    - Contact title unknown or vague: -10 points
    - No industry information: -10 points
    - Company name appears to be a person's name: -25 points (not a valid company)
    
    MINIMUM SCORE IS 0. Maximum is 100. Be CONSERVATIVE with scores.
    A score above 70 should ONLY be given to leads with: clear industry fit, known company size, verified pain signals, and buying triggers.
    Most leads with incomplete data should score between 20-50.
  
  "fitScoreBreakdown": "Detailed breakdown showing points awarded for each factor AND any penalties applied",
  
  "priority": "hot (80-100 - RARE, only verified high-quality leads), warm (60-79 - good potential with some gaps), cool (40-59 - needs more discovery), or cold (0-39 - low quality or incomplete data)",
  
  "linkedInUrl": "LinkedIn profile URL from scraped data or found via search",
  "phoneNumber": "Phone number if found",
  "jobTitle": "Accurate job title from LinkedIn data",
  "companyWebsite": "Company website URL - VERY IMPORTANT: Always include if found from scraped data or search",
  "companyAddress": "Company headquarters address if found",
  
  "confidenceAssessment": {
    "overall": "high/medium/low - Your overall confidence that this research is about the CORRECT company and person",
    "companyInfoConfidence": "high/medium/low - Confidence that company information is accurate and about the right entity",
    "contactInfoConfidence": "high/medium/low - Confidence that contact information matches the right person at this company",
    "reasoning": "Explain WHY you assigned these confidence levels. Be specific about what evidence supports or undermines confidence.",
    "warnings": [
      "List any red flags or concerns about data accuracy",
      "Examples: 'Multiple companies with similar names found', 'Contact may have left company', 'Website domain doesn't match company name', 'Limited verifiable sources'"
    ]
  }
}

CONFIDENCE ASSESSMENT GUIDELINES:
- HIGH confidence: Multiple corroborating sources (website, LinkedIn, news), company domain matches email domain, recent activity confirms current employment
- MEDIUM confidence: Some verification but gaps exist (e.g., LinkedIn found but not recently updated, company website found but contact not mentioned)
- LOW confidence: Significant uncertainty (e.g., common company name with multiple entities, no verifiable website, contact might have wrong company, generic email domain)

BE HONEST about uncertainty. It's better to flag potential issues than give false confidence.

BE THOROUGH. Use the pre-scraped data as your primary source.`;

  console.log(`[LeadResearch] Calling Claude for dossier generation...`);
  console.log(`[LeadResearch] Prompt length: ${prompt.length} chars`);

  const text = await callClaudeWithRetry({
    prompt,
    systemPrompt: "You are an expert B2B sales intelligence analyst preparing comprehensive dossiers for sales calls. Always respond with valid JSON only, no markdown code blocks.",
    maxTokens: 8000,
    temperature: 0.7
  });
  
  console.log(`[LeadResearch] Raw dossier response length: ${text.length}`);
  
  const raw = extractJsonFromResponse(text) as Record<string, unknown>;

  // Calculate score with penalties
  const aiScore = typeof raw.fitScore === "number" ? raw.fitScore : 50;
  const penalties = calculateFitScorePenalties(lead, scraped.scrapedIntel, scraped.contactLinkedIn);
  const finalScore = applyScorePenalties(aiScore, penalties);
  const adjustedPriority = determinePriority(finalScore);
  const fullBreakdown = formatPenaltyBreakdown(
    aiScore,
    penalties,
    finalScore,
    extractString(raw.fitScoreBreakdown)
  );

  // Normalize confidence assessment
  const confidenceAssessment = normalizeConfidenceAssessment(
    raw.confidenceAssessment as Record<string, unknown> | undefined
  );

  const dossier: LeadDossier = {
    companySummary: extractString(raw.companySummary),
    companyNews: extractArray<string>(raw.companyNews),
    painPoints: extractArray<PainPoint>(raw.painPoints),
    productMatches: extractArray<ProductMatch>(raw.productMatches),
    techStackIntel: extractArray<string>(raw.techStackIntel),
    buyingTriggers: extractArray<string>(raw.buyingTriggers),

    contactBackground: extractString(raw.contactBackground),
    careerHistory: extractArray<CareerHistoryItem>(raw.careerHistory),
    professionalInterests: extractArray<string>(raw.professionalInterests),
    decisionMakingStyle: extractString(raw.decisionMakingStyle),

    commonGround: extractArray<string>(raw.commonGround),
    openingLine: extractString(raw.openingLine),
    talkTrack: extractArray<string>(raw.talkTrack),
    discoveryQuestions: extractArray<string>(raw.discoveryQuestions),
    objectionHandles: extractArray<{ objection: string; response: string }>(raw.objectionHandles),
    theAsk: extractString(raw.theAsk),

    fitScore: finalScore,
    fitScoreBreakdown: fullBreakdown,
    priority: adjustedPriority,

    sources: scraped.scrapedIntel.sources.join(" | ") + " | Claude AI",
    linkedInUrl: scraped.contactLinkedIn?.linkedInUrl || extractString(raw.linkedInUrl),
    phoneNumber: phoneFromScrape || extractString(raw.phoneNumber),
    jobTitle: scraped.contactLinkedIn?.currentTitle || extractString(raw.jobTitle),
    companyWebsite: lead.companyWebsite || scraped.scrapedIntel.website?.url || extractString(raw.companyWebsite),
    companyAddress: extractString(raw.companyAddress),
    confidenceAssessment
  };
  
  console.log(`[LeadResearch] Dossier generated. AI Score: ${aiScore}, Penalties: ${penalties.length}, Final: ${finalScore}, Priority: ${adjustedPriority}, Confidence: ${confidenceAssessment.overall}`);
  
  return dossier;
}

export interface ResearchResult {
  packet: InsertResearchPacket;
  discoveredInfo: {
    linkedInUrl?: string;
    phoneNumber?: string;
    jobTitle?: string;
    companyWebsite?: string;
  };
  structuredData: {
    dossier: LeadDossier;
    xIntel: XIntelResult;
    linkedInProfile: LinkedInProfile;
    companyHardIntel: CompanyHardIntel;
    deepResearch?: DeepResearchData;
  };
  researchMode: 'fast' | 'deep';
}

export async function researchLead(
  lead: Lead,
  options: ResearchOptions = { mode: 'fast' }
): Promise<ResearchResult> {
  const { mode, sources } = options;
  console.log(`[LeadResearch] Starting ${mode.toUpperCase()} research for ${lead.contactName} at ${lead.companyName}`);

  // Always gather fast/API-based research first
  const preScraped = await gatherAllIntelInParallel(lead);
  preScraped.researchMode = mode;

  // Add deep research if requested
  if (mode === 'deep') {
    console.log(`[LeadResearch] Deep mode enabled, gathering Browserless intelligence...`);
    const deepData = await gatherDeepResearchData(lead, sources);
    preScraped.deepResearch = deepData;
  }

  const dossier = await generateLeadDossier(lead, preScraped);
  
  const linkedInProfile = formatContactLinkedInAsProfile(preScraped.contactLinkedIn);

  console.log(`[LeadResearch] All research completed. Fit score: ${dossier.fitScore}, Priority: ${dossier.priority}`);

  const companyIntel = [
    dossier.companySummary,
    "",
    "## Recent News",
    ...dossier.companyNews.map(n => `- ${n}`),
    "",
    "## Tech Stack",
    ...dossier.techStackIntel.map(t => `- ${t}`),
    "",
    "## Buying Triggers",
    ...dossier.buyingTriggers.map(b => `- ${b}`)
  ].join("\n");

  const contactIntel = [
    dossier.contactBackground,
    "",
    "## Career History",
    ...dossier.careerHistory.map(c => `- ${c.title} at ${c.company} (${c.duration}): ${c.relevance}`),
    "",
    "## Professional Interests",
    dossier.professionalInterests.join(", "),
    "",
    "## Decision Making Style",
    dossier.decisionMakingStyle,
    "",
    "## Common Ground",
    ...dossier.commonGround.map(c => `- ${c}`)
  ].join("\n");

  const painSignals = dossier.painPoints.map(p => 
    `[${p.severity.toUpperCase()}] ${p.pain} → ${p.bsaSolution}`
  ).join("\n");

  const fitAnalysis = [
    `Fit Score: ${dossier.fitScore}/100`,
    `Priority: ${dossier.priority.toUpperCase()}`,
    "",
    "## Score Breakdown",
    dossier.fitScoreBreakdown,
    "",
    "## Product Matches",
    ...dossier.productMatches.map(p => 
      `- ${p.productName} (${p.matchScore}%): ${p.rationale}`
    )
  ].join("\n");

  const talkTrack = [
    "## Opening Line",
    dossier.openingLine,
    "",
    "## Key Value Propositions",
    ...dossier.talkTrack.map((t, i) => `${i + 1}. ${t}`),
    "",
    "## The Ask",
    dossier.theAsk
  ].join("\n");

  const discoveryQuestions = dossier.discoveryQuestions.join("\n");

  const objectionHandles = dossier.objectionHandles.map(o => 
    `**${o.objection}**\n${o.response}`
  ).join("\n\n");

  const packet: InsertResearchPacket = {
    leadId: lead.id,
    companyIntel,
    contactIntel,
    painSignals,
    competitorPresence: dossier.techStackIntel.join(", "),
    fitAnalysis,
    fitScore: dossier.fitScore,
    priority: dossier.priority,
    talkTrack,
    discoveryQuestions,
    objectionHandles,
    companyHardIntel: formatCompanyHardIntel(preScraped.companyHardIntel),
    xIntel: formatXIntel(preScraped.xIntel),
    linkedInIntel: formatLinkedInIntel(linkedInProfile),
    sources: dossier.sources,
    verificationStatus: "ai_generated",
    painPointsJson: dossier.painPoints,
    productMatchesJson: dossier.productMatches,
    linkedInProfileJson: linkedInProfile,
    xIntelJson: preScraped.xIntel,
    careerHistoryJson: dossier.careerHistory,
    dossierJson: dossier
  };

  return {
    packet,
    discoveredInfo: {
      linkedInUrl: linkedInProfile.profileUrl || dossier.linkedInUrl,
      phoneNumber: dossier.phoneNumber,
      jobTitle: linkedInProfile.currentPosition?.title || dossier.jobTitle,
      companyWebsite: dossier.companyWebsite
    },
    structuredData: {
      dossier,
      xIntel: preScraped.xIntel,
      linkedInProfile,
      companyHardIntel: preScraped.companyHardIntel,
      deepResearch: preScraped.deepResearch
    },
    researchMode: mode
  };
}

// ─── Scrubbing Agent ──────────────────────────────────────────────────────────

export interface ScrubResult {
  leadId: string;
  companyName: string;
  fitScore: number;
  priority: 'hot' | 'warm' | 'cool' | 'cold';
  qualifies: boolean;
  disqualificationReason?: string;
  reasoning: string;
  durationMs: number;
}

/**
 * Lightweight lead scoring using Claude Haiku — no web scraping, no external APIs.
 * Takes only the data already in the lead record and returns a fit score + qualification decision.
 * ~1-3 seconds per lead. Use before running the full Dossier Agent.
 */
export async function scrubLead(lead: Lead): Promise<ScrubResult> {
  const startedAt = Date.now();

  const prompt = `You are a lead qualification specialist for Hawk Ridge Systems (HRS), the leading reseller of SolidWorks, CATIA, 3D printing solutions, and engineering simulation software in North America.

## ICP (Ideal Customer Profile)
- Engineering teams using or evaluating CAD/PLM/simulation tools
- Industries: Aerospace & Defense, Medical Devices, Automotive, Industrial Equipment, Electronics, Consumer Products
- Company size: 10–5,000 employees
- Pain: legacy CAD (AutoCAD, Inventor, Pro/E, NX, Creo), PDM/PLM chaos, slow product development cycles
- Disqualify: retail, restaurants, real estate, non-profits, pure software companies with no physical product

## Lead to Evaluate
- Company: ${lead.companyName}
- Industry: ${lead.companyIndustry || 'Unknown'}
- Company Size: ${lead.companySize || 'Unknown'}
- Contact: ${lead.contactName}
- Title: ${lead.contactTitle || 'Unknown'}
- Source: ${lead.source || 'manual'}
- Description: ${lead.companyDescription || 'Not provided'}

## Task
Score this lead 0–100 and decide if it qualifies for outreach.

Scoring guide:
- 80–100: Perfect ICP match (engineering company, right industry, clear CAD/PLM need)
- 60–79: Good fit, some signals missing
- 40–59: Marginal fit, needs more info
- 0–39: Poor fit, disqualify

Return ONLY valid JSON (no markdown, no explanation outside the JSON):
{
  "fitScore": <0-100 integer>,
  "priority": <"hot"|"warm"|"cool"|"cold">,
  "qualifies": <true|false>,
  "disqualificationReason": <string if qualifies=false, else null>,
  "reasoning": <1-2 sentence explanation>
}`;

  const client = getClaudeClient();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  let parsed: { fitScore: number; priority: string; qualifies: boolean; disqualificationReason?: string; reasoning: string };
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    // Fallback if JSON parse fails
    parsed = { fitScore: 50, priority: 'cool', qualifies: true, reasoning: 'Could not parse AI response — defaulting to manual review.' };
  }

  const priority = (['hot', 'warm', 'cool', 'cold'].includes(parsed.priority)
    ? parsed.priority
    : determinePriority(parsed.fitScore)) as 'hot' | 'warm' | 'cool' | 'cold';

  return {
    leadId: lead.id,
    companyName: lead.companyName,
    fitScore: Math.min(100, Math.max(0, Math.round(parsed.fitScore))),
    priority,
    qualifies: parsed.qualifies,
    disqualificationReason: parsed.qualifies ? undefined : (parsed.disqualificationReason ?? 'Does not meet ICP criteria'),
    reasoning: parsed.reasoning,
    durationMs: Date.now() - startedAt,
  };
}
