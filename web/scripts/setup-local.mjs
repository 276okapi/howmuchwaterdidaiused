// Prepares a local test environment (called by start-local.ps1, can be run on its own):
//  1. creates the database from DATABASE_URL if it does not exist (utf8mb4)
//  2. creates / updates tables (scripts/migrate.mjs)
//  3. creates a demo account and fills it with data from ../raport.html (if present)
//
//   node scripts/setup-local.mjs            all of the above
//   node scripts/setup-local.mjs --no-demo  without the demo account
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (existsSync(p)) process.loadEnvFile(p);
}

export const DEMO_EMAIL = "demo@example.com";
export const DEMO_PASSWORD = "demo-haslo-123";
const noDemo = process.argv.includes("--no-demo");

// --- 1. database ---------------------------------------------------------------
const dbUrl = new URL(process.env.DATABASE_URL || "");
const dbName = decodeURIComponent(dbUrl.pathname.replace(/^\//, ""));
if (!/^[\w$]+$/.test(dbName)) {
  console.error(`Niepoprawna nazwa bazy w DATABASE_URL: "${dbName}"`);
  process.exit(1);
}
const serverUrl = new URL(dbUrl);
serverUrl.pathname = "/";
let conn;
try {
  conn = await createConnection({ uri: serverUrl.toString() });
} catch (e) {
  console.error(`Nie mogę połączyć się z MySQL/MariaDB (${dbUrl.host}): ${e.code || e.message}`);
  console.error("Sprawdź, czy serwer bazy działa (np. MySQL w panelu XAMPP) i czy dane w web/.env są poprawne.");
  process.exit(2);
}
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.end();
console.log(`Baza ${dbName}: OK`);

// --- 2. tables -----------------------------------------------------------------
const mig = spawnSync(process.execPath, [path.join(root, "scripts", "migrate.mjs")], { stdio: "inherit", cwd: root });
if (mig.status !== 0) process.exit(mig.status ?? 1);

if (noDemo) process.exit(0);

// --- 3. demo account + data ------------------------------------------------------
const { betterAuth } = await import("better-auth");
const { authOptions } = await import("../src/lib/auth-options.mjs");
const { getPool } = await import("../src/lib/db.mjs");
const { readRaport } = await import("./lib/raport-data.mjs");

const auth = betterAuth(authOptions());
const pool = getPool();
try {
  let [[user]] = await pool.query("SELECT id FROM cw_user WHERE email = ?", [DEMO_EMAIL]);
  if (!user) {
    await auth.api.signUpEmail({ body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo" } });
    [[user]] = await pool.query("SELECT id FROM cw_user WHERE email = ?", [DEMO_EMAIL]);
    console.log("Konto demo: utworzone");
  } else {
    console.log("Konto demo: istnieje");
  }

  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM cw_turn WHERE user_id = ?", [user.id]);
  const raport = path.resolve(root, "..", "raport.html");
  if (n > 0) {
    console.log(`Dane demo: ${n} promptów już w bazie`);
  } else if (existsSync(raport)) {
    const turns = readRaport(raport);
    const rows = turns.map(t => [user.id, t.sid, new Date(t.s), JSON.stringify(t)]);
    for (let i = 0; i < rows.length; i += 500) {
      await pool.query(
        `INSERT INTO cw_turn (user_id, sid, started_at, data) VALUES ?
         ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP(3)`,
        [rows.slice(i, i + 500)],
      );
    }
    console.log(`Dane demo: wczytano ${turns.length} promptów z raport.html (bez treści promptów)`);
  } else {
    console.log("Dane demo: brak ../raport.html, konto demo zostaje puste (uruchom najpierw build-report.ps1)");
  }
} finally {
  await pool.end();
}
