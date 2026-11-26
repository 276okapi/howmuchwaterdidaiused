// POST /api/ingest - the local agent sends prompt metrics here.
// Auth: personal API key in the "x-api-key" header (or "Authorization: Bearer <key>").
// Body: { "turns": [ { s, e, sid, m, o, in, cr, cw, h2o, usd, ... } ] }
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MAX_TURNS_PER_REQUEST, sanitizeTurn, upsertTurns, type Turn } from "@/lib/turns";

export const dynamic = "force-dynamic";

function readKey(req: Request) {
  const h = req.headers.get("x-api-key");
  if (h) return h.trim();
  const a = req.headers.get("authorization");
  return a?.toLowerCase().startsWith("bearer ") ? a.slice(7).trim() : null;
}

export async function POST(req: Request) {
  const key = readKey(req);
  if (!key) return NextResponse.json({ error: "Brak klucza API" }, { status: 401 });

  const v = await auth.api.verifyApiKey({ body: { key } });
  if (!v.valid || !v.key) {
    return NextResponse.json({ error: v.error?.message ?? "Nieprawidłowy klucz API" }, { status: 401 });
  }
  const userId = v.key.referenceId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Treść żądania to nie JSON" }, { status: 400 });
  }
  const list = (body as { turns?: unknown })?.turns;
  if (!Array.isArray(list)) return NextResponse.json({ error: "Brak tablicy turns" }, { status: 400 });
  if (list.length > MAX_TURNS_PER_REQUEST) {
    return NextResponse.json({ error: `Maksymalnie ${MAX_TURNS_PER_REQUEST} wierszy na żądanie` }, { status: 413 });
  }

  const ok: Turn[] = [];
  const rejected: { index: number; reason: string }[] = [];
  list.forEach((raw, index) => {
    const t = sanitizeTurn(raw);
    if (typeof t === "string") rejected.push({ index, reason: t });
    else ok.push(t);
  });

  await upsertTurns(userId, ok);
  return NextResponse.json({ accepted: ok.length, rejected: rejected.slice(0, 50), rejectedCount: rejected.length });
}
