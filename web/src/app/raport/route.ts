// GET /raport - the same interactive report as the local version (report-template.html),
// filled with the signed-in user's data from the database.
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

const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// JSON inside <script>: never let data close the tag
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login?next=/raport", req.url));

  const turns = await getTurns(session.user.id);
  if (!turns.length) return NextResponse.redirect(new URL("/konto?pusto=1", req.url));

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

  const bar = `
<style>
  .cw-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
    max-width:1240px;margin:0 auto;padding:10px 16px;border-bottom:1px solid var(--border);font-size:13px;color:var(--ink2)}
  .cw-bar a{color:var(--ink);text-decoration:none;margin-left:14px}
  .cw-bar a:hover{text-decoration:underline}
  .cw-bar b{color:var(--ink);font-weight:600}
</style>
<nav class="cw-bar"><span>💧 <b>Claude Water Tracker</b> · ${esc(session.user.name || session.user.email)}</span>
<span><a href="/raport">Raport</a><a href="/konto">Konto i klucze API</a></span></nav>`;

  const html = (await template())
    .replace("/*__DATA__*/[]", () => scriptJson(data))
    .replace("/*__META__*/{}", () => scriptJson(meta))
    .replace("<body>", () => "<body>" + bar);

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}
