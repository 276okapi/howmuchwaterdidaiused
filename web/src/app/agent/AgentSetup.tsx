"use client";
import { useState } from "react";
import { pick, type Lang, type L as LFn } from "@/lib/i18n";

const SYSTEMS = [
  { id: "windows", label: "Windows", ready: true },
  { id: "macos", label: "macOS", ready: false },
  { id: "linux", label: "Linux", ready: false },
];

const SOURCES = [
  { name: "Claude Code", ready: true },
  { name: "OpenAI Codex CLI", ready: false },
  { name: "Gemini CLI", ready: false },
  { name: "Cursor", ready: false },
  { name: "GitHub Copilot", ready: false },
];

const I = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export default function AgentSetup({ lang }: { lang: Lang }) {
  const L = pick(lang);
  const [tab, setTab] = useState<"installer" | "manual">("installer");
  const [script, setScript] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadScript() {
    setScriptError(null);
    try {
      const res = await fetch("/api/agent/script", { cache: "no-store" });
      const text = await res.text();
      if (res.ok) setScript(text);
      else setScriptError(text || L(`Serwer odpowiedział błędem ${res.status}.`, `The server answered with error ${res.status}.`));
    } catch {
      setScriptError(L("Brak połączenia ze stroną.", "Cannot reach the site."));
    }
  }

  function openManual() {
    setTab("manual");
    if (script === null) loadScript();
  }

  function copy() {
    if (!script) return;
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  const lines = script ? script.split("\n").length : 0;

  return (
    <div className="agent-layout">
      <aside className="agent-side">
      <section className="card agent-pick">
        <div>
          <h2>System</h2>
          <div className="choice" role="radiogroup" aria-label="System">
            {SYSTEMS.map(s => (
              <button key={s.id} role="radio" aria-checked={s.id === "windows"} disabled={!s.ready}>
                {s.label}
                {!s.ready && <small>{L("wkrótce", "soon")}</small>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>{L("Źródło danych", "Data source")}</h2>
          <ul className="sources">
            {SOURCES.map(s => (
              <li key={s.name} className={s.ready ? "" : "off"}>
                <span className="check" aria-hidden>{s.ready ? "✓" : ""}</span>
                {s.name}
                {!s.ready && <small>{L("wkrótce", "soon")}</small>}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <DataScope mode={tab} L={L} />
      </aside>

      <div className="agent-main">
      <div className="agent-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "installer"} onClick={() => setTab("installer")}>
          {L("Instalator", "Installer")}
        </button>
        <button role="tab" aria-selected={tab === "manual"} onClick={openManual}>
          {L("Ręcznie: skopiuj kod", "Manual: copy the code")}
        </button>
      </div>

      {tab === "installer" ? (
        <section className="card agent-tab">
          <ol className="steps">
            <li>
              <h3>{L("Pobierz instalator", "Download the installer")}</h3>
              <p>{L("Klucz Twojego konta jest już w środku, więc nie przekazuj pliku innym.", "Your account key is already inside, so do not pass the file on to others.")}</p>
              <a className="btn btn-primary" href="/api/agent/download?os=windows">{L("Pobierz", "Download")} howmuchwaterdidaiused-setup.exe</a>
            </li>
            <li>
              <h3>{L("Uruchom go", "Run it")}</h3>
              <p>
                {L(
                  "Instalator nie ma jeszcze podpisu cyfrowego, więc Windows może pokazać okno „System Windows chronił ten komputer”. Kliknij wtedy „Więcej informacji”, a potem „Uruchom mimo to”. Uprawnienia administratora nie są potrzebne.",
                  "The installer is not digitally signed yet, so Windows may show “Windows protected your PC”. Click “More info”, then “Run anyway”. No administrator rights are needed.",
                )}
              </p>
            </li>
            <li>
              <h3>{L("Wybierz opcje i kliknij Zainstaluj", "Pick the options and click Install")}</h3>
              <p>
                {L(
                  "Źródło danych, jak często wysyłać dane i co udostępniasz. Instalator ustawia wysyłanie w tle i od razu wysyła pierwsze dane. Ustawienia zmienisz później z menu Start: „howmuchwaterdidaiused”.",
                  "The data source, how often to send data and what you share. The installer sets up sending in the background and sends the first data right away. Change the settings later from the Start menu: “howmuchwaterdidaiused”. The installer is in Polish for now.",
                )}
              </p>
            </li>
          </ol>
        </section>
      ) : (
        <section className="card agent-tab manual">
          <div className="todo">
            <div className="todo-item">
              <h3><span className="todo-icon"><svg {...I}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 12v6M9.5 15.5 12 18l2.5-2.5" /></svg></span>{L("Zapisz jako plik", "Save it as a file")}</h3>
              <p><code>howmuchwaterdidaiused.ps1</code> {L("w", "in")} <code>%LOCALAPPDATA%\howmuchwaterdidaiused</code>. {L("Klucz konta jest już w środku.", "Your account key is already inside.")}</p>
            </div>
            <div className="todo-item">
              <h3><span className="todo-icon"><svg {...I}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>{L("Uruchamiaj co godzinę", "Run it every hour")}</h3>
              <p>{L("Np. w Harmonogramie zadań; gotowe polecenie jest na początku kodu.", "For example with Task Scheduler; a ready command is at the top of the code.")}</p>
            </div>
            <div className="todo-item">
              <h3><span className="todo-icon"><svg {...I}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></span>{L("Wybierz, co udostępniasz", "Choose what you share")}</h3>
              <p>{L("Dwa przełączniki w sekcji", "Two switches in the")} <code>{L("USTAWIENIA", "SETTINGS")}</code>{L(", domyślnie wyłączone.", " section, off by default.")}</p>
            </div>
          </div>

          <Cadence L={L} />

          <div className="editor">
            <div className="editor-bar">
              <span className="editor-tab">
                <svg {...I} width={14} height={14}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                howmuchwaterdidaiused.ps1
              </span>
              {script && <span className="editor-meta">{lines} {L("linii, z kluczem Twojego konta", "lines, with your account key")}</span>}
              <span className="editor-actions">
                <button className="btn btn-ghost" onClick={copy} disabled={!script}>{copied ? L("Skopiowano", "Copied") : L("Kopiuj", "Copy")}</button>
                <a className="btn btn-ghost" href="/api/agent/script?download=1">{L("Pobierz plik", "Download file")}</a>
              </span>
            </div>
            {scriptError ? (
              <div className="editor-error">
                <p>{scriptError}</p>
                <button className="btn btn-ghost" onClick={loadScript}>{L("Spróbuj ponownie", "Try again")}</button>
              </div>
            ) : (
              <pre className="editor-code">{script ?? L("Wczytuję kod agenta…", "Loading the agent code…")}</pre>
            )}
          </div>

        </section>
      )}
      </div>
    </div>
  );
}

/** How often to run the agent: a log-scale track from 10 minutes to 3 days with the sensible range marked. */
function Cadence({ L }: { L: LFn }) {
  // positions on a log scale 10 min .. 3 days
  const pos = (min: number) => `${((Math.log(min) - Math.log(10)) / (Math.log(4320) - Math.log(10))) * 100}%`;
  return (
    <figure className="cadence" aria-label={L("Jak często uruchamiać agenta", "How often to run the agent")}>
      <figcaption>
        <b>{L("Jak często?", "How often?")}</b>{" "}
        {L(
          "Najlepiej co godzinę. Częściej niż co 30 minut nie ma sensu, bo agent wysyła tylko nowe dane, a rzadziej niż raz dziennie sprawi, że Twoje wyniki będą nieaktualne.",
          "Every hour works best. More often than every 30 minutes makes no sense, since the agent only sends new data, and less than once a day leaves your results out of date.",
        )}
      </figcaption>
      <div className="cadence-track">
        <span className="zone ok" style={{ left: pos(30), width: `calc(${pos(1440)} - ${pos(30)})` }} />
        <span className="pin" style={{ left: pos(60) }} />
      </div>
      <div className="cadence-scale">
        <span className="far" style={{ left: 0 }}>{L("za często", "too often")}</span>
        <span style={{ left: pos(30) }}>{L("co 30 min", "every 30 min")}</span>
        <span className="best" style={{ left: pos(60) }}>{L("co godzinę", "every hour")}<br /><small>{L("zalecane", "recommended")}</small></span>
        <span style={{ left: pos(1440) }}>{L("raz dziennie", "once a day")}</span>
        <span className="far end" style={{ right: 0 }}>{L("za rzadko", "too rarely")}</span>
      </div>
    </figure>
  );
}

/** What the agent sends: always the numbers; prompt text and project names only when switched on. */
function DataScope({ mode, L }: { mode: "installer" | "manual"; L: LFn }) {
  const always = L(
    ["Czas pracy", "Tokeny", "Model", "Koszt", "Woda", "Przerwania i błędy"],
    ["Working time", "Tokens", "Model", "Cost", "Water", "Interruptions and errors"],
  );
  const optional = [
    {
      name: L("Treść promptów", "Prompt text"),
      how: mode === "manual" ? <code>shareText = $true</code> : L("pole „Udostępniaj treść promptów”", "the “Share prompt text” option"),
      off: L("Bez niej nie będzie raportów z promptów (najczęstsze słowa, sformułowania, podgląd treści).", "Without it there are no prompt reports (top words, phrases, text preview)."),
    },
    {
      name: L("Nazwy projektów", "Project names"),
      how: mode === "manual" ? <code>shareProjects = $true</code> : L("pole „Udostępniaj nazwy projektów”", "the “Share project names” option"),
      off: L("Bez nich: „projekt 1”, „projekt 2”… zamiast nazw folderów.", "Without them: “project 1”, “project 2”… instead of folder names."),
    },
  ];
  return (
    <div className="scope">
      <div className="scope-col">
        <h3>{L("Agent wysyła zawsze", "The agent always sends")}</h3>
        <ul className="chips">
          {always.map(a => <li key={a}>{a}</li>)}
        </ul>
        <p className="scope-note">{L("Liczby dla każdego promptu. Na komputerze agent nic nie wyświetla ani nie zapisuje.", "Numbers for each prompt. On your computer the agent shows and saves nothing.")}</p>
      </div>
      <div className="scope-col">
        <h3>{L("Tylko gdy włączysz", "Only when you switch it on")}</h3>
        {optional.map(o => (
          <div key={o.name} className="opt">
            <span className="switch" aria-hidden><span /></span>
            <div>
              <b>{o.name}</b> <span className="opt-how">{o.how}</span>
              <p>{o.off}</p>
            </div>
          </div>
        ))}
        <p className="scope-note">{L("Anonimizacja odbywa się na komputerze, przed wysłaniem.", "Anonymising happens on your computer, before sending.")}</p>
      </div>
    </div>
  );
}
