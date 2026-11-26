// Copies the report template from the repository root into web/templates/, so the
// local report (build-report.ps1) and the website share one source of truth.
// On the hosting only web/ is uploaded, together with the copied file.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "..", "..", "report-template.html");
const dstDir = path.resolve(here, "..", "templates");
const dst = path.join(dstDir, "report-template.html");

if (existsSync(src)) {
  mkdirSync(dstDir, { recursive: true });
  copyFileSync(src, dst);
  console.log("report-template.html -> web/templates/");
} else if (existsSync(dst)) {
  console.log("Brak ../report-template.html, używam istniejącej kopii w web/templates/");
} else {
  console.error("Nie znaleziono report-template.html");
  process.exit(1);
}
