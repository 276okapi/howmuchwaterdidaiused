// GET /raport/widok - the same interactive report as the local version (report-template.html),
// filled with the signed-in user's data. Shown in a frame on /pulpit, /dni and /prompty.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLastIngest, getTurns } from "@/lib/turns";
import { WATER } from "@/lib/water";

export const dynamic = "force-dynamic";

let templateCache: string | null = null;
async function template() {
  if (templateCache && process.env.NODE_ENV === "production") return templateCache;
  templateCache = await readFile(path.join(process.cwd(), "templates", "report-template.html"), "utf8");
  return templateCache;
}

// Inside the app the menu replaces the report's own view tabs and theme switch
// (theme is shared through localStorage "promptStatsTheme", set by the app menu).
const EMBED_HEAD = "<style>.topbar{display:none}main{padding-top:24px}</style>";
// tells the app which view is shown, so the address and the menu follow clicks inside the report
const EMBED_SCRIPT = `<script>(function(){
  function send(){ parent.postMessage({ cwHash: location.hash }, location.origin); }
  addEventListener("hashchange", send); send();
})();</script>`;

// JSON inside <script>: never let data close the tag
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("Sesja wygasła. Zaloguj się ponownie.", { status: 401 });

  const turns = await getTurns(session.user.id);

  const last = await getLastIngest(session.user.id);
  // prompt text never reaches the server; the template expects strings
  const data = turns.map(t => ({ ...t, x: "", tw: "" }));
  const meta = {
    generated: (last ?? new Date()).toISOString(),
    sessions: new Set(turns.map(t => t.sid)).size,
    prompts: turns.length,
    idleGap: 15,
    corrWindow: 30,
    water: WATER,
    online: true,
  };

  const html = (await template())
    .replace("/*__DATA__*/[]", () => scriptJson(data))
    .replace("/*__META__*/{}", () => scriptJson(meta))
    .replace("</head>", () => EMBED_HEAD + "</head>")
    .replace("</body>", () => EMBED_SCRIPT + "</body>");

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}
