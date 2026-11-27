// GET /api/agent/download?os=windows
// The installer AIWaterTracker-Setup.exe with the site address and the user's agent key
// appended at the end (after CONFIG_MARKER), so it needs no typing. `&klucz=0`: without them.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAgentKey } from "@/lib/agent-key";
import { CONFIG_MARKER, SETUP_EXE, publicUrl, readAgentFile } from "@/lib/agent";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Zaloguj się, żeby pobrać agenta." }, { status: 401 });

  const url = new URL(req.url);
  if ((url.searchParams.get("os") ?? "windows") !== "windows") {
    return NextResponse.json({ error: "Na razie agent jest dostępny tylko dla Windows." }, { status: 400 });
  }

  let exe: Buffer;
  try {
    exe = await readAgentFile(SETUP_EXE);
  } catch {
    return NextResponse.json({ error: "Instalator nie jest dostępny na serwerze (brak agent-dist)." }, { status: 500 });
  }

  let body = exe;
  if (url.searchParams.get("klucz") !== "0") {
    const { key } = await getAgentKey(session.user.id);
    const config = JSON.stringify({ server: publicUrl(req), apiKey: key });
    body = Buffer.concat([exe, Buffer.from(`\r\n${CONFIG_MARKER}${config}`, "utf8")]);
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${SETUP_EXE}"`,
      "cache-control": "private, no-store",
    },
  });
}
