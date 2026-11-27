// One agent key per user, embedded by the site into the installer and the one-file agent.
// Better Auth stores API keys only as hashes, so the plain key is kept encrypted in cw_agent_key.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { auth } from "./auth";
import { getPool } from "./db.mjs";

export type AgentKey = { key: string; id: string; start: string; createdAt: Date; lastRequest: Date | null };

function cipherKey() {
  if (!process.env.BETTER_AUTH_SECRET) throw new Error("Brak BETTER_AUTH_SECRET w .env");
  return createHash("sha256").update(`${process.env.BETTER_AUTH_SECRET}:cw-agent-key`).digest();
}

function encrypt(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64");
}

function decrypt(b64: string) {
  const raw = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", cipherKey(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

// The table normally comes from `npm run migrate`; created here too, so a running server that has not
// been migrated yet still works (same definition as in db/schema.sql).
let tableReady: Promise<unknown> | null = null;
function ensureTable() {
  tableReady ??= getPool()
    .query(
      `CREATE TABLE IF NOT EXISTS cw_agent_key (
         user_id VARCHAR(36) NOT NULL, apikey_id VARCHAR(36) NOT NULL, key_enc TEXT NOT NULL,
         created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
         PRIMARY KEY (user_id),
         CONSTRAINT fk_cw_agent_key_user FOREIGN KEY (user_id) REFERENCES cw_user (id) ON DELETE CASCADE
       ) ENGINE=InnoDB`,
    )
    .catch(e => {
      tableReady = null;
      throw e;
    });
  return tableReady;
}

/** The user's agent key; created on first use (or when the stored one no longer works). */
export async function getAgentKey(userId: string): Promise<AgentKey> {
  await ensureTable();
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT k.key_enc, a.id, a.start, a.createdAt, a.lastRequest, a.enabled
       FROM cw_agent_key k JOIN cw_apikey a ON a.id = k.apikey_id
      WHERE k.user_id = ?`,
    [userId],
  );
  const row = rows[0];
  if (row && row.enabled) {
    try {
      return { key: decrypt(row.key_enc), id: row.id, start: row.start ?? "", createdAt: row.createdAt, lastRequest: row.lastRequest };
    } catch {
      /* secret changed: make a new key below */
    }
  }

  const created = await auth.api.createApiKey({
    body: { name: "Agent", userId, metadata: { source: "agent" } },
  });
  await pool.query(
    `INSERT INTO cw_agent_key (user_id, apikey_id, key_enc) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE apikey_id = VALUES(apikey_id), key_enc = VALUES(key_enc), created_at = CURRENT_TIMESTAMP(3)`,
    [userId, created.id, encrypt(created.key)],
  );
  return { key: created.key, id: created.id, start: created.start ?? "", createdAt: new Date(created.createdAt), lastRequest: null };
}

/** After a leak: revokes ALL API keys of the user (old installations stop sending) and makes a new agent key. */
export async function rotateAgentKey(userId: string): Promise<AgentKey> {
  await ensureTable();
  const pool = getPool();
  await pool.query("DELETE FROM cw_apikey WHERE referenceId = ?", [userId]);
  await pool.query("DELETE FROM cw_agent_key WHERE user_id = ?", [userId]);
  return getAgentKey(userId);
}
