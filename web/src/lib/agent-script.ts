// Builds the one-file agent (howmuchwaterdidaiused.ps1) for the "manual" setup: the site address and the
// user's agent key are written in, sync.ps1 is the logic and the counting script with its rules
// travels inside as text. The result is pure ASCII on purpose: code pasted into Notepad is saved
// without a BOM, and Windows PowerShell 5.1 would then misread any non-ASCII character.
import { readAgentFile } from "./agent";

export const ONE_FILE_NAME = "howmuchwaterdidaiused.ps1";

const PL: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
  "„": '"', "”": '"', "“": '"', "’": "'", "‘": "'", "…": "...", "–": "-", "—": "-", " ": " ",
};

/** Polish letters without diacritics, typographic marks as ASCII, anything else as "?". */
const ascii = (s: string) => s.replace(/[^\x00-\x7f]/g, c => PL[c] ?? "?");

/** Non-ASCII characters inside JSON strings as \uXXXX escapes (same meaning, ASCII file). */
const jsonAscii = (s: string) =>
  s.replace(/[^\x00-\x7f]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

const psQuote = (s: string) => "'" + s.replace(/'/g, "''") + "'";

async function text(name: Parameters<typeof readAgentFile>[0]) {
  return (await readAgentFile(name)).toString("utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
}

function hereString(content: string) {
  if (/^'@/m.test(content)) throw new Error("Embedded file contains a line starting with '@");
  return "@'\n" + content.replace(/\n+$/, "") + "\n'@";
}

export async function buildOneFileAgent(opts: { server: string; apiKey: string; lang?: "pl" | "en" }) {
  const sync = await text("sync.ps1");
  const lines = sync.split("\n");
  const pStart = lines.findIndex(l => l.startsWith("param("));
  const marker = lines.findIndex(l => l.startsWith("# --- end of parameters"));
  if (pStart < 0 || marker < 0) throw new Error("sync.ps1: param block or marker not found");
  const params = lines.slice(pStart, marker).join("\n");
  const body = lines.slice(marker + 1).join("\n").replace(/^\n+/, "");

  const files: [string, string][] = [
    ["build-report.ps1", ascii(await text("build-report.ps1"))],
    ["reguly.json", jsonAscii(await text("reguly.json"))],
    ["woda.json", jsonAscii(await text("woda.json"))],
    ["ceny.json", jsonAscii(await text("ceny.json"))],
  ];

  const scheduleCmd =
    'schtasks /Create /F /SC HOURLY /TN "howmuchwaterdidaiused" /TR "powershell -NoProfile -NonInteractive ' +
    '-WindowStyle Hidden -ExecutionPolicy Bypass -File \\"%LOCALAPPDATA%\\howmuchwaterdidaiused\\' + ONE_FILE_NAME + '\\" -Quiet"';

  const en = opts.lang === "en";
  const header = en
    ? `  howmuchwaterdidaiused - agent for Windows (one file)

  Counts the stats of your work with an AI assistant on this computer (Claude Code for now)
  and sends them to your account: ${ascii(opts.server)}
  It shows nothing and saves no reports on disk. You see the report on the website.

  PLEASE: set this script to run automatically EVERY HOUR.
  More often than every 30 minutes makes no sense (the agent only sends new data), and less
  than once a day leaves your results on the website out of date.

  Example: save this file as %LOCALAPPDATA%\\howmuchwaterdidaiused\\${ONE_FILE_NAME}
  and run this once in Command Prompt (cmd), no administrator rights needed:

    ${scheduleCmd}

  First send right away (in the folder with this file):
    powershell -NoProfile -ExecutionPolicy Bypass -File .\\${ONE_FILE_NAME}

  The code holds your account's API key - do not share this file. If it leaked,
  generate a new one on the website (Account page) and download the agent again.
  Log: %LOCALAPPDATA%\\howmuchwaterdidaiused\\sync.log`
    : `  howmuchwaterdidaiused - agent dla Windows (jeden plik)

  Liczy statystyki Twojej pracy z asystentem AI na tym komputerze (na razie Claude Code)
  i wysyla je na Twoje konto: ${ascii(opts.server)}
  Nic nie wyswietla i nie zapisuje raportow na dysku. Raport ogladasz na stronie.

  PROSBA: ustaw automatyczne uruchamianie tego skryptu CO GODZINE.
  Czesciej niz co 30 minut nie ma sensu (agent wysyla tylko nowe dane), a rzadziej niz
  raz dziennie sprawi, ze Twoje wyniki na stronie beda nieaktualne.

  Przyklad: zapisz ten plik jako %LOCALAPPDATA%\\howmuchwaterdidaiused\\${ONE_FILE_NAME}
  i raz uruchom w Wierszu polecenia (cmd), bez uprawnien administratora:

    ${scheduleCmd}

  Pierwsze wyslanie od razu (w folderze z tym plikiem):
    powershell -NoProfile -ExecutionPolicy Bypass -File .\\${ONE_FILE_NAME}

  W kodzie jest klucz API Twojego konta - nie udostepniaj tego pliku. Jesli wyciekl,
  wygeneruj nowy na stronie w zakladce Konto i pobierz agenta ponownie.
  Dziennik: %LOCALAPPDATA%\\howmuchwaterdidaiused\\sync.log`;
  const settings = en
    ? `# ===== SETTINGS (you can change these) ========================================================
$AgentConfig = @{
    server        = ${psQuote(opts.server)}
    apiKey        = ${psQuote(opts.apiKey)}
    sources       = @('claude-code')   # data sources; only Claude Code for now
    # Prompt text (first 200 characters): $true = send, $false = stays on this computer.
    # Note: without it the website has no prompt reports (Prompts view: top words, phrases
    # and text preview). Tokens, time, cost and water work the same either way.
    shareText     = $false
    # Project names (folder names): $true = send, $false = "projekt 1", "projekt 2"...
    shareProjects = $false
}`
    : `# ===== USTAWIENIA (mozesz zmienic) ===========================================================
$AgentConfig = @{
    server        = ${psQuote(opts.server)}
    apiKey        = ${psQuote(opts.apiKey)}
    sources       = @('claude-code')   # zrodla danych; na razie tylko Claude Code
    # Tresc promptow (pierwsze 200 znakow): $true = wysylaj, $false = zostaje na komputerze.
    # Uwaga: bez tresci na stronie nie bedzie raportow z promptow (widok Prompty: najczestsze
    # slowa, sformulowania i podglad tresci). Tokeny, czas, koszt i woda dzialaja tak samo.
    shareText     = $false
    # Nazwy projektow (nazwy folderow): $true = wysylaj, $false = "projekt 1", "projekt 2"...
    shareProjects = $false
}`;

  const out = `#requires -Version 5.1
<#
${header}
#>
${ascii(params)}

${settings}

# ===== AGENT ===================================================================================
function Invoke-AgentSync {
${ascii(body).replace(/\n+$/, "")}
}

# ===== PLIKI LICZACE (nie zmieniaj; agent zapisuje je w %LOCALAPPDATA%\\howmuchwaterdidaiused) =====
$AgentFiles = @{}
${files.map(([name, content]) => `$AgentFiles['${name}'] = ${hereString(content)}`).join("\n\n")}

Invoke-AgentSync
`;
  return out.replace(/\n/g, "\r\n");
}
