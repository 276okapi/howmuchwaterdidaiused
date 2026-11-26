// Reads the prompt data embedded in a local report (raport.html from build-report.ps1).
// Privacy: prompt text (x, tw) is removed here; project names become "projekt 1", "projekt 2"...
// unless keepProjects is true.
import { readFileSync } from "node:fs";

export function readRaport(file, { keepProjects = false } = {}) {
  const html = readFileSync(file, "utf8");
  const marker = "const RAW = ";
  const at = html.indexOf(marker);
  if (at < 0) throw new Error(`W pliku ${file} nie ma danych raportu`);

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
  return raw.map(({ x, tw, ...t }) => ({ ...t, p: pseudo(t.p) }));
}
