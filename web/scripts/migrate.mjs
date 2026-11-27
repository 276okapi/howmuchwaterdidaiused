// Creates / updates the tables in the database from DATABASE_URL:
//  - Better Auth tables (cw_user, cw_session, cw_account, cw_verification, cw_apikey, cw_rate_limit)
//  - application tables from db/schema.sql (cw_turn)
// Safe to run many times: only missing tables and columns are added.
//
//   npm run migrate            apply
//   npm run migrate -- --sql   print the SQL only, change nothing
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (existsSync(p)) process.loadEnvFile(p);
}

const { getMigrations } = await import("better-auth/db/migration");
const { authOptions } = await import("../src/lib/auth-options.mjs");
const { getPool } = await import("../src/lib/db.mjs");

const dryRun = process.argv.includes("--sql");
const pool = getPool();
const appSql = readFileSync(path.join(root, "db", "schema.sql"), "utf8")
  // statements end with ";" at the end of a line (a "-- comment" may follow it)
  .split(/;[ \t]*(?:--[^\n]*)?$/m)
  .map(s => s.trim())
  .filter(s => s && !/^(--[^\n]*\n?)+$/.test(s));

try {
  const { toBeCreated, toBeAdded, runMigrations, compileMigrations } = await getMigrations(authOptions());
  if (dryRun) {
    console.log(await compileMigrations());
    console.log(appSql.join(";\n\n") + ";");
  } else {
    if (toBeCreated.length || toBeAdded.length) {
      await runMigrations();
      console.log("Better Auth: nowe tabele:", toBeCreated.map(t => t.table).join(", ") || "-",
        "| nowe kolumny w:", toBeAdded.map(t => t.table).join(", ") || "-");
    } else {
      console.log("Better Auth: schemat aktualny");
    }
    for (const stmt of appSql) await pool.query(stmt);
    console.log("Tabele aplikacji: OK");
  }
} finally {
  await pool.end();
}
