import { db } from "../server/db";
import { users } from "../shared/schema";
import bcrypt from "bcrypt";

const hash = await bcrypt.hash("HRdemo2026", 10);
const result = await db.update(users).set({ password: hash });
console.log("✅ All passwords updated to HRdemo2026");
process.exit(0);
