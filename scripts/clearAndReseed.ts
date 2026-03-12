import { db } from "../server/db";
import { sql } from "drizzle-orm";

console.log("🗑️  Clearing all demo data...");

// Delete in order (foreign key constraints)
await db.execute(sql`DELETE FROM manager_call_analyses`);
await db.execute(sql`DELETE FROM call_sessions`);
await db.execute(sql`DELETE FROM live_coaching_tips`);
await db.execute(sql`DELETE FROM live_coaching_sessions`);
await db.execute(sql`DELETE FROM live_transcripts`);
await db.execute(sql`DELETE FROM research_packets`);
await db.execute(sql`DELETE FROM salesforce_sync_log`);
await db.execute(sql`DELETE FROM leads`);
await db.execute(sql`DELETE FROM navigation_settings`);
await db.execute(sql`DELETE FROM users`);
await db.execute(sql`DELETE FROM sdrs`);
await db.execute(sql`DELETE FROM account_executives`);
await db.execute(sql`DELETE FROM managers`);

console.log("✅ All data cleared");
process.exit(0);
