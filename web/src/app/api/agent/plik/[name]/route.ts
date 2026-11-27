// GET /api/agent/plik/<name>             an agent file as text (shown on the Agent page)
// GET /api/agent/plik/<name>?pobierz=1   the same as a download (used by the installer)
// Public on purpose: these are the agent's source files, nothing personal is in them.
import { NextResponse } from "next/server";
import { isAgentFile, readAgentFile } from "@/lib/agent";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!isAgentFile(name)) return new NextResponse("Nie ma takiego pliku.", { status: 404 });

  const body = await readAgentFile(name);
  const download = new URL(req.url).searchParams.get("pobierz") === "1";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      // the files keep their bytes (UTF-8 with BOM, CRLF), so a downloaded copy runs as is
      "content-type": `${download ? "application/octet-stream" : "text/plain"}; charset=utf-8`,
      ...(download ? { "content-disposition": `attachment; filename="${name}"` } : {}),
      "cache-control": "no-cache",
    },
  });
}
