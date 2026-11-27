// POST /api/agent/key - generates a new agent key (after a leak). All previous API keys of the
// user stop working, so installed agents must be installed again with the new key.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rotateAgentKey } from "@/lib/agent-key";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  // a plain form/fetch from another site must not rotate the key
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin && origin !== process.env.BETTER_AUTH_URL) {
    return NextResponse.json({ error: "Niedozwolone źródło żądania." }, { status: 403 });
  }
  const k = await rotateAgentKey(session.user.id);
  return NextResponse.json({ start: k.start, createdAt: k.createdAt });
}
