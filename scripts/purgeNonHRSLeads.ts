/**
 * purgeNonHRSLeads.ts
 * Deletes BSA-era leads that don't fit HRS ICP, keeping only engineering/manufacturing leads.
 * Run with: npx tsx scripts/purgeNonHRSLeads.ts
 */

import "dotenv/config";
import { db } from "../server/db";
import { leads, researchPackets, callSessions, managerCallAnalyses } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";

// Industries that are valid for HRS
const HRS_INDUSTRIES = [
  "aerospace",
  "defense",
  "medical",
  "automotive",
  "industrial",
  "electronics",
  "manufacturing",
  "engineering",
  "consumer products",
  "robotics",
  "energy",
  "semiconductor",
];

// Company names from our seeded HRS leads — always keep these
const HRS_SEED_EMAILS = [
  "kweston@ducommun.com",
  "scho@nateleng.com",
  "jthornton@l3harris.com",
  "pnguyen@integer.net",
  "rfinley@kapcoglobal.com",
  "mpark@orchid-ortho.com",
  "cespinoza@martinrea.com",
  "amorrison@protolabs.com",
  "treeves@curtisswright.com",
  "lhartmann@ufpt.com",
  "bkowalski@dynamicmfg.com",
  "dwalsh@iec-electronics.com",
  "spark@moog.com",
  "rtompkins@acuitybrands.com",
  "mengel@hayneswire.com",
];

function isHRSRelevant(lead: { companyIndustry: string | null; contactEmail: string | null }): boolean {
  // Always keep our seeded HRS leads
  if (lead.contactEmail && HRS_SEED_EMAILS.includes(lead.contactEmail.toLowerCase())) return true;

  // Keep if industry matches HRS ICP
  const industry = (lead.companyIndustry || "").toLowerCase();
  return HRS_INDUSTRIES.some((i) => industry.includes(i));
}

async function purge() {
  console.log("\n🧹 HRS Demo — Purging non-HRS leads\n");

  const allLeads = await db.select().from(leads);
  console.log(`📊 Total leads in DB: ${allLeads.length}`);

  const toKeep = allLeads.filter(isHRSRelevant);
  const toDelete = allLeads.filter((l) => !isHRSRelevant(l));

  console.log(`✅ Keeping: ${toKeep.length} HRS-relevant leads`);
  console.log(`🗑  Deleting: ${toDelete.length} BSA-era leads\n`);

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
    process.exit(0);
  }

  // Show what we're deleting (sample)
  console.log("Sample of leads being deleted:");
  toDelete.slice(0, 10).forEach((l) =>
    console.log(`   - ${l.companyName} (${l.companyIndustry || "no industry"}) — ${l.contactEmail}`)
  );
  if (toDelete.length > 10) console.log(`   ... and ${toDelete.length - 10} more`);

  const deleteIds = toDelete.map((l) => l.id);

  // Get call session IDs for these leads (needed for manager_call_analyses FK)
  const sessions = await db
    .select({ id: callSessions.id })
    .from(callSessions)
    .where(inArray(callSessions.leadId, deleteIds));
  const sessionIds = sessions.map((s) => s.id);

  // 1. Delete manager_call_analyses (FK → call_sessions)
  if (sessionIds.length > 0) {
    await db.delete(managerCallAnalyses).where(inArray(managerCallAnalyses.callSessionId, sessionIds));
  }

  // 2. Delete research packets (FK → leads)
  await db.delete(researchPackets).where(inArray(researchPackets.leadId, deleteIds));

  // 3. Delete call sessions (FK → leads)
  await db.delete(callSessions).where(inArray(callSessions.leadId, deleteIds));

  // 4. Delete leads
  await db.delete(leads).where(inArray(leads.id, deleteIds));

  console.log(`\n✅ Done!`);
  console.log(`   Leads deleted: ${toDelete.length}`);
  console.log(`   Leads remaining: ${toKeep.length}\n`);

  // Show what's left by industry
  const byIndustry: Record<string, number> = {};
  for (const l of toKeep) {
    const k = l.companyIndustry || "Unknown";
    byIndustry[k] = (byIndustry[k] || 0) + 1;
  }
  console.log("Remaining leads by industry:");
  for (const [industry, count] of Object.entries(byIndustry).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${count.toString().padStart(3)}  ${industry}`);
  }

  process.exit(0);
}

purge().catch((err) => {
  console.error("❌ Purge failed:", err);
  process.exit(1);
});
