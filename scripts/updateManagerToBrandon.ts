/**
 * updateManagerToBrandon.ts
 * Updates the primary demo manager account to Brandon Zahn / HRS credentials.
 * Run with: npx tsx scripts/updateManagerToBrandon.ts
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import { db } from "../server/db";
import { users, managers } from "../shared/schema";
import { eq } from "drizzle-orm";

const OLD_EMAIL = "roberto.hernandez@hawkridgesys.com";
const NEW_NAME  = "Brandon Zahn";
const NEW_EMAIL = "brandonz@hawkridgesys.com";
const NEW_PASS  = "HRdemo2026";

async function run() {
  console.log("\n🔄 Updating demo manager account to Brandon Zahn...\n");

  const hashedPassword = await bcrypt.hash(NEW_PASS, 10);

  // Update users table
  const [updatedUser] = await db
    .update(users)
    .set({ email: NEW_EMAIL, name: NEW_NAME, password: hashedPassword })
    .where(eq(users.email, OLD_EMAIL))
    .returning();

  if (!updatedUser) {
    console.error(`❌ User not found with email: ${OLD_EMAIL}`);
    process.exit(1);
  }
  console.log(`✅ users: ${OLD_EMAIL} → ${NEW_EMAIL}`);

  // Update managers table
  const [updatedManager] = await db
    .update(managers)
    .set({ email: NEW_EMAIL, name: NEW_NAME })
    .where(eq(managers.email, OLD_EMAIL))
    .returning();

  if (updatedManager) {
    console.log(`✅ managers: ${OLD_EMAIL} → ${NEW_EMAIL}`);
  }

  console.log(`\n🔑 New login:`);
  console.log(`   Email:    ${NEW_EMAIL}`);
  console.log(`   Password: ${NEW_PASS}`);
  console.log(`   Role:     manager\n`);

  process.exit(0);
}

run().catch(err => {
  console.error("❌ Update failed:", err);
  process.exit(1);
});
