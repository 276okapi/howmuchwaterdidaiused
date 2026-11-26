// Sends the data of a local report (raport.html made by build-report.ps1) to the website.
// A stop-gap until the real local agent exists, so the online report can be tested.
//
//   node scripts/import-raport.mjs --url https://woda.example.pl --key cw_xxx ../raport.html
//
// Privacy: prompt text (x, tw) is removed HERE, before anything leaves the computer.
// Project names are replaced with "projekt 1", "projekt 2"... unless --keep-project-names.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const flag = name => {
  const i = args.indexOf(name);
  return i >= 0 ? (args.splice(i, 1), true) : false;
};

const url = (opt("--url") || process.env.CW_URL || "http://localhost:3000").replace(/\/+$/, "");
const key = opt("--key") || process.env.CW_API_KEY;
const keepProjects = flag("--keep-project-names");
const file = args[0] || "../raport.html";

if (!key) {
  console.error("Podaj klucz API: --key cw_... (utworzysz go na stronie Konto)");
  process.exit(1);
}

const html = readFileSync(file, "utf8");
const marker = "const RAW = ";
const at = html.indexOf(marker);
if (at < 0) {
  console.error(`W pliku ${file} nie ma danych raportu`);
  process.exit(1);
}
// the data is one JSON array right after the marker; find its end by bracket matching
let depth = 0, inStr = false, end = -1;
for (let i = at + marker.length; i < html.length; i++) {
  const c = html[i];
  if (inStr) {
    if (c === "\\") i++;
    else if (c === '"') inStr = false;
  } else if (c === '"') inStr = true;
  else if (c === "[" || c === "{") depth++;
  else if (c === "]" || c === "}") {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}
const raw = JSON.parse(html.slice(at + marker.length, end));

const projects = new Map();
const pseudo = p => {
  if (keepProjects) return p;
  if (!projects.has(p)) projects.set(p, `projekt ${projects.size + 1}`);
  return projects.get(p);
};
const turns = raw.map(({ x, tw, ...t }) => ({ ...t, p: pseudo(t.p) }));

let accepted = 0, rejected = 0;
for (let i = 0; i < turns.length; i += 1000) {
  const res = await fetch(`${url}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ turns: turns.slice(i, i + 1000) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Błąd ${res.status}: ${body.error || res.statusText}`);
    process.exit(1);
  }
  accepted += body.accepted;
  rejected += body.rejectedCount;
  if (body.rejectedCount) console.warn("Odrzucone:", body.rejected);
}
console.log(`Wysłano ${turns.length} promptów: przyjęte ${accepted}, odrzucone ${rejected}. Raport: ${url}/raport`);
