// Generic runner: POSTs the contents of a .sql file to the Supabase Management API.
// Usage: node scripts/apply-migration.mjs <projectRef> <sqlFilePath> <accessToken>
import { readFileSync } from "node:fs";

const [ref, sqlPath, token] = process.argv.slice(2);
if (!ref || !sqlPath || !token) {
  console.error("Usage: node scripts/apply-migration.mjs <projectRef> <sqlFilePath> <accessToken>");
  process.exit(1);
}

const query = readFileSync(sqlPath, "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
console.log("HTTP", res.status);
console.log(await res.text());
if (!res.ok) process.exit(1);
