// Copies files shared with the rest of the repository into web/, because on the hosting
// only web/ is uploaded:
//   ../report-template.html             -> templates/report-template.html (report on the site)
//   ../agent/windows/{AIWaterTracker-Setup.exe, sync.ps1, register-task.ps1}
//   + ../{build-report.ps1, reguly.json, woda.json, ceny.json} -> agent-dist/windows/ (the agent)
// Runs before `npm run dev` and `npm run build`. When the repository files are not there
// (e.g. on the hosting), the copies already in web/ are kept.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(web, "..");

function copy(src, dstDir, name = path.basename(src)) {
  if (!existsSync(src)) return false;
  mkdirSync(dstDir, { recursive: true });
  copyFileSync(src, path.join(dstDir, name));
  return true;
}

// report template
const tplDir = path.join(web, "templates");
if (copy(path.join(repo, "report-template.html"), tplDir)) console.log("report-template.html -> web/templates/");
else if (!existsSync(path.join(tplDir, "report-template.html"))) {
  console.error("Nie znaleziono report-template.html");
  process.exit(1);
}

// agent (Windows): the installer and the files it downloads from the site
const agentSrc = path.join(repo, "agent", "windows");
const agentDst = path.join(web, "agent-dist", "windows");
if (existsSync(agentSrc)) {
  const fromAgent = ["AIWaterTracker-Setup.exe", "sync.ps1", "register-task.ps1"];
  const fromRepo = ["build-report.ps1", "reguly.json", "woda.json", "ceny.json"];
  for (const f of fromAgent) if (!copy(path.join(agentSrc, f), agentDst)) console.warn(`Brak ../agent/windows/${f}`);
  for (const f of fromRepo) if (!copy(path.join(repo, f), agentDst)) console.warn(`Brak ../${f} dla agenta`);
  console.log("agent/windows + skrypty liczące -> web/agent-dist/windows/");
} else if (!existsSync(agentDst)) {
  console.warn("Brak ../agent/windows: pobieranie agenta nie będzie działać");
}
