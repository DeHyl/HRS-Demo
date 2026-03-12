import { db } from "../server/db";
import { users } from "../shared/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

const email = "carlos.martinez@hawkridgesys.com";
const password = "HRdemo2026";

// Find user
const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

if (!user) {
  console.log("❌ User NOT FOUND in DB:", email);
  console.log("\n📋 All users in DB:");
  const allUsers = await db.select({ id: users.id, email: users.email, role: users.role }).from(users).limit(10);
  allUsers.forEach(u => console.log(`   ${u.email} (${u.role})`));
} else {
  console.log("✅ User found:", user.email, "| role:", user.role);
  const match = await bcrypt.compare(password, user.password);
  console.log(match ? "✅ Password MATCHES" : "❌ Password DOES NOT match");
  console.log("   Hash stored:", user.password.substring(0, 20) + "...");
}

process.exit(0);
