import { db } from "../server/db";
import { sql } from "drizzle-orm";

const result = await db.execute(sql`
  SELECT u.email, u.role, COUNT(l.id) as lead_count
  FROM users u
  JOIN sdrs s ON u.sdr_id = s.id
  JOIN leads l ON l.assigned_sdr_id = s.id
  GROUP BY u.email, u.role
  ORDER BY lead_count DESC
  LIMIT 5
`);
result.rows.forEach((r: any) => console.log(`${r.email} — ${r.lead_count} leads`));
process.exit(0);
