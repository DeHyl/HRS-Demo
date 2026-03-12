import { db } from "../server/db";
import { leads, users } from "../shared/schema";
import { sql } from "drizzle-orm";

const leadCount = await db.select({ count: sql<number>`count(*)` }).from(leads);
const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);

console.log("Total leads in DB:", leadCount[0].count);
console.log("Total users in DB:", userCount[0].count);

const sample = await db.select({
  id: leads.id,
  company: leads.companyName,
  sdr: leads.assignedSdrId
}).from(leads).limit(3);

console.log("Sample leads:", JSON.stringify(sample, null, 2));
process.exit(0);
