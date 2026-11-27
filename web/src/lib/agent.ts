// The agent: files in web/agent-dist/windows/ (copied by scripts/copy-shared.mjs).
// The installer (AIWaterTracker-Setup.exe) downloads the agent files below from
// /api/agent/plik/<name> at install time; the manual setup shows them for copying.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const AGENT_VERSION = "1.0.0";
export const SETUP_EXE = "AIWaterTracker-Setup.exe";
/** Marker after which the site appends {server, apiKey} to the installer (read by Setup.cs). */
export const CONFIG_MARKER = "#AIWT-CONFIG#";

/** Agent files, in the order shown in the manual setup. */
export const WINDOWS_FILES = [
  { name: "sync.ps1", about: "liczy statystyki, anonimizuje i wysyła je na stronę" },
  { name: "build-report.ps1", about: "liczenie statystyk z transkryptów Claude Code" },
  { name: "register-task.ps1", about: "ustawia wysyłanie w Harmonogramie zadań (opcjonalnie)" },
  { name: "reguly.json", about: "reguły wykrywania poprawek" },
  { name: "woda.json", about: "przelicznik wody" },
  { name: "ceny.json", about: "ceny modeli (agent aktualizuje je sam)" },
] as const;

export type AgentFileName = (typeof WINDOWS_FILES)[number]["name"];
export const isAgentFile = (n: string): n is AgentFileName => WINDOWS_FILES.some(f => f.name === n);

// in a repository checkout (local development) the sources are read directly, so edits show up
// without restarting; on the hosting only the copies in agent-dist/ exist
const REPO_SOURCES: Record<string, string> = {
  "sync.ps1": "agent/windows/sync.ps1",
  "register-task.ps1": "agent/windows/register-task.ps1",
  [SETUP_EXE]: `agent/windows/${SETUP_EXE}`,
  "build-report.ps1": "build-report.ps1",
  "reguly.json": "reguly.json",
  "woda.json": "woda.json",
  "ceny.json": "ceny.json",
};

export function readAgentFile(name: AgentFileName | typeof SETUP_EXE) {
  if (process.env.NODE_ENV !== "production") {
    const src = path.join(process.cwd(), "..", REPO_SOURCES[name]);
    if (existsSync(src)) return readFile(src);
  }
  return readFile(path.join(process.cwd(), "agent-dist", "windows", name));
}

/** Public address of the site, given to the agent. */
export function publicUrl(req: Request) {
  return (process.env.BETTER_AUTH_URL || new URL(req.url).origin).replace(/\/+$/, "");
}

/** Address of the site when there is no request at hand (page rendering): from .env. */
export function publicUrlFromEnv() {
  return (process.env.BETTER_AUTH_URL || "").replace(/\/+$/, "");
}
