// GET /api/agent/skrypt             the one-file agent with the user's agent key, as text (shown on the page)
// GET /api/agent/skrypt?pobierz=1   the same as ai-water-tracker.ps1 to save
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAgentKey } from "@/lib/agent-key";
import { publicUrl } from "@/lib/agent";
import { ONE_FILE_NAME, buildOneFileAgent } from "@/lib/agent-script";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Zaloguj się.", { status: 401 });

  let script: string;
  try {
    const { key } = await getAgentKey(session.user.id);
    script = await buildOneFileAgent({ server: publicUrl(req), apiKey: key });
  } catch (e) {
    console.error("agent script:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`Nie udało się przygotować kodu agenta: ${msg}`, { status: 500 });
  }
  const download = new URL(req.url).searchParams.get("pobierz") === "1";
  return new NextResponse(script, {
    headers: {
      "content-type": `${download ? "application/octet-stream" : "text/plain"}; charset=utf-8`,
      ...(download ? { "content-disposition": `attachment; filename="${ONE_FILE_NAME}"` } : {}),
      "cache-control": "private, no-store",
    },
  });
}
