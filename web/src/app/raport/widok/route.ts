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
const EMBED_HEAD = `<style>
.topbar{display:none}
main{padding-top:24px}
/* Pulpit as fluid blocks: they wrap to the next row when the window is narrower and scale with it.
   Wide screen: KPIs in one row, water / calendar / projects side by side, the daily chart below. */
body.fit main:has(#viewDash:not([hidden])){max-width:1800px;padding:clamp(8px,1.2vw,16px) clamp(8px,1.4vw,20px)}
body.fit #summary{margin:0 0 clamp(6px,1vh,12px);font-size:13px}
body.fit #viewDash:not([hidden]){display:grid;gap:12px;
  grid-template-columns:repeat(auto-fit,minmax(max(min(100%,330px),calc((100% - 24px)/3)),1fr))}
body.fit #viewDash .card{margin:0;padding:clamp(10px,1vw,14px);min-width:0;display:flex;flex-direction:column}
body.fit #viewDash>.card:first-child{grid-column:1/-1;padding:clamp(8px,.8vw,10px)}
body.fit #viewDash .kpis{grid-template-columns:repeat(8,minmax(0,1fr));gap:8px}
@media (max-width:1300px){body.fit #viewDash .kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:640px){body.fit #viewDash .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
body.fit #viewDash .kpi{padding:8px 10px}
body.fit #viewDash .kpi .v{font-size:clamp(18px,1.5vw,24px)}
body.fit .dash-row{display:contents}
/* the row of water / calendar / projects keeps one height that follows the window */
body.fit .dash-row>.card,body.fit #viewDash>.card:has(#projTbl){height:clamp(250px,33vh,440px);overflow:hidden}
body.fit #viewDash>.card:has(#projTbl){order:1}
body.fit #viewDash>.card:has(#projTbl) .table-wrap{flex:1;min-height:0;overflow:auto}
body.fit #viewDash>.card:has(#bars){order:2;grid-column:1/-1;height:clamp(240px,34vh,520px)}
body.fit #bars{flex:1;min-height:120px;position:relative}
body.fit #bars>svg{position:absolute;inset:0;width:100%;height:100%}
body.fit #waterNote{display:none}
body.fit #viewDash .head{margin-bottom:8px}
</style>`;
// tells the app which view is shown, so the address and the menu follow clicks inside the report
const EMBED_SCRIPT = `<script>(function(){
  function send(){ parent.postMessage({ cwHash: location.hash }, location.origin); }
  addEventListener("hashchange", send); send();
  // one-screen dashboard: the chart takes the height the layout gives it
  document.body.classList.add("fit");
  var bars = document.getElementById("bars");
  if (bars) { bars.dataset.fill = "1"; dispatchEvent(new Event("resize")); }
})();</script>`;

// JSON inside <script>: never let data close the tag
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("Sesja wygasła. Zaloguj się ponownie.", { status: 401 });

  const turns = await getTurns(session.user.id);

  const last = await getLastIngest(session.user.id);
  // prompt text is there only if the user shared it; the template expects strings
  const data = turns.map(t => ({ ...t, x: typeof t.x === "string" ? t.x : "", tw: typeof t.tw === "string" ? t.tw : "" }));
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
