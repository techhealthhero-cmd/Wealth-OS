// Temporary script: applies supabase/migrations/0003_wealth_engine.sql to the
// live project via the Supabase Management API. Deleted before this task
// finishes (matches the repo's established temp-script convention).
import { readFileSync } from "node:fs";

const TOKEN = process.argv[2];
const PROJECT_REF = process.argv[3] ?? "lvxuruzspchhcwebrbzy";

if (!TOKEN) {
  console.error("Usage: node _migrate.mjs <management-api-access-token> [project-ref]");
  process.exit(1);
}

const sql = readFileSync("supabase/migrations/0003_wealth_engine.sql", "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();
console.log("status:", res.status);
console.log(body);

if (!res.ok) process.exit(1);
console.log("\nMigration 0003_wealth_engine.sql applied successfully.");
