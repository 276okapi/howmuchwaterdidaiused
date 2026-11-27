// Prompt metrics ("turns") sent by the local agent, stored per user.
// Privacy: the agent removes the prompt text (x, tw) and project names (p) on the user's
// computer unless the user agreed to share them at install time. Shared text is shown
// only in that user's own report.
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "./db.mjs";

const NUM = ["c", "w", "img", "o", "t", "r", "a", "in", "cr", "cw", "h2o", "usd", "usds", "k"] as const;
const BOOL = ["i", "nx", "q", "pst"] as const;
// strings and their maximum length; x = prompt excerpt, tw = its own words (only if shared)
const STR: Record<string, number> = { p: 120, m: 400, kr: 120, x: 1000, tw: 4000 };

export type Turn = Record<string, unknown> & { s: string; e: string; sid: string };

export const MAX_TURNS_PER_REQUEST = 5000;
const MAX_FUTURE_MS = 24 * 3600 * 1000;

/** Validates one turn from the agent and keeps only allowed fields. Returns an error string on bad input. */
export function sanitizeTurn(raw: unknown): Turn | string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "wiersz nie jest obiektem";
  const r = raw as Record<string, unknown>;
  const s = Date.parse(String(r.s)), e = Date.parse(String(r.e));
  if (!Number.isFinite(s) || !Number.isFinite(e)) return "brak poprawnych dat s/e";
  if (e < s) return "koniec przed początkiem";
  if (s > Date.now() + MAX_FUTURE_MS) return "data z przyszłości";
  if (typeof r.sid !== "string" || !/^[\w-]{1,64}$/.test(r.sid)) return "niepoprawne sid";

  const out: Turn = { s: new Date(s).toISOString(), e: new Date(e).toISOString(), sid: r.sid };
  for (const k of NUM) {
    if (r[k] === undefined || r[k] === null) continue;
    const v = Number(r[k]);
    if (!Number.isFinite(v) || v < 0) return `niepoprawne pole ${k}`;
    out[k] = v;
  }
  for (const k of BOOL) if (r[k] !== undefined) out[k] = r[k] === true;
  for (const [k, max] of Object.entries(STR)) {
    if (typeof r[k] === "string") out[k] = (r[k] as string).slice(0, max);
  }
  if (Array.isArray(r.g)) {
    const g = r.g
      .filter((x): x is [number, number] => Array.isArray(x) && x.length === 2 && x.every(n => Number.isFinite(n)))
      .slice(0, 500);
    if (g.length) out.g = g;
  }
  return out;
}

/** Inserts or replaces turns of one user; (user, session, start) identifies a turn, so re-sending is idempotent. */
export async function upsertTurns(userId: string, turns: Turn[]) {
  if (!turns.length) return 0;
  const pool = getPool();
  let affected = 0;
  for (let i = 0; i < turns.length; i += 500) {
    const chunk = turns.slice(i, i + 500);
    const rows = chunk.map(t => [userId, t.sid, new Date(t.s), JSON.stringify(t)]);
    const [res] = await pool.query(
      `INSERT INTO cw_turn (user_id, sid, started_at, data) VALUES ?
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP(3)`,
      [rows],
    );
    affected += (res as { affectedRows: number }).affectedRows;
  }
  return affected;
}

export async function getTurns(userId: string): Promise<Turn[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT data FROM cw_turn WHERE user_id = ? ORDER BY started_at",
    [userId],
  );
  // MariaDB returns JSON columns as text, MySQL as parsed objects
  return rows.map(r => (typeof r.data === "string" ? JSON.parse(r.data) : r.data));
}

export async function getLastIngest(userId: string): Promise<Date | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT MAX(updated_at) AS last FROM cw_turn WHERE user_id = ?",
    [userId],
  );
  return rows[0]?.last ?? null;
}
