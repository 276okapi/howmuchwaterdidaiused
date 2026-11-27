"use client";
import { useState } from "react";

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

export default function AgentSetup() {
  const [tab, setTab] = useState<"installer" | "manual">("installer");
  const [script, setScript] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadScript() {
    setScriptError(null);
    try {
      const res = await fetch("/api/agent/skrypt", { cache: "no-store" });
      const text = await res.text();
      if (res.ok) setScript(text);
      else setScriptError(text || `Serwer odpowiedział błędem ${res.status}.`);
    } catch {
      setScriptError("Brak połączenia ze stroną.");
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
    <>
      <section className="card agent-pick">
        <div>
          <h2>System</h2>
          <div className="choice" role="radiogroup" aria-label="System">
            {SYSTEMS.map(s => (
              <button key={s.id} role="radio" aria-checked={s.id === "windows"} disabled={!s.ready}>
                {s.label}
                {!s.ready && <small>wkrótce</small>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>Źródło danych</h2>
          <ul className="sources">
            {SOURCES.map(s => (
              <li key={s.name} className={s.ready ? "" : "off"}>
                <span className="check" aria-hidden>{s.ready ? "✓" : ""}</span>
                {s.name}
                {!s.ready && <small>wkrótce</small>}
              </li>
            ))}
          </ul>
          <p className="hint">Na razie dostępne jest tylko Claude Code.</p>
        </div>
      </section>

      <div className="agent-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "installer"} onClick={() => setTab("installer")}>
          Instalator
        </button>
        <button role="tab" aria-selected={tab === "manual"} onClick={openManual}>
          Ręcznie: skopiuj kod
        </button>
      </div>

      {tab === "installer" ? (
        <section className="card">
          <ol className="steps">
            <li>
              <h3>Pobierz instalator</h3>
              <p>Klucz Twojego konta jest już w środku, więc nie przekazuj pliku innym.</p>
              <a className="btn btn-primary" href="/api/agent/download?os=windows">Pobierz AIWaterTracker-Setup.exe</a>
            </li>
            <li>
              <h3>Uruchom go</h3>
              <p>
                Instalator nie ma jeszcze podpisu cyfrowego, więc Windows może pokazać okno „System Windows
                chronił ten komputer”. Kliknij wtedy „Więcej informacji”, a potem „Uruchom mimo to”.
                Uprawnienia administratora nie są potrzebne.
              </p>
            </li>
            <li>
              <h3>Wybierz opcje i kliknij Zainstaluj</h3>
              <p>
                Źródło danych, jak często wysyłać dane i co udostępniasz. Instalator ustawia wysyłanie w tle
                i od razu wysyła pierwsze dane. Ustawienia zmienisz później z menu Start: „AI Water Tracker”.
              </p>
            </li>
          </ol>
          <DataScope mode="installer" />
        </section>
      ) : (
        <section className="card">
          <div className="todo">
            <div className="todo-item">
              <span className="todo-icon"><svg {...I}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 12v6M9.5 15.5 12 18l2.5-2.5" /></svg></span>
              <h3>Zapisz kod jako plik</h3>
              <p>Nazwij go <code>ai-water-tracker.ps1</code> i zapisz w folderze <code>AIWaterTracker</code> w <code>%LOCALAPPDATA%</code>. Klucz Twojego konta jest już w środku.</p>
            </div>
            <div className="todo-item">
              <span className="todo-icon"><svg {...I}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>
              <h3>Uruchamiaj go co godzinę</h3>
              <p>Np. w Harmonogramie zadań. Gotowe polecenie jest na początku kodu.</p>
            </div>
            <div className="todo-item">
              <span className="todo-icon"><svg {...I}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></span>
              <h3>Zdecyduj, co udostępniasz</h3>
              <p>Dwa przełączniki w sekcji <code>USTAWIENIA</code>. Domyślnie oba są wyłączone.</p>
            </div>
          </div>

          <Cadence />

          <div className="editor">
            <div className="editor-bar">
              <span className="editor-tab">
                <svg {...I} width={14} height={14}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                ai-water-tracker.ps1
              </span>
              {script && <span className="editor-meta">{lines} linii, z kluczem Twojego konta</span>}
              <span className="editor-actions">
                <button className="btn btn-ghost" onClick={copy} disabled={!script}>{copied ? "Skopiowano" : "Kopiuj"}</button>
                <a className="btn btn-ghost" href="/api/agent/skrypt?pobierz=1">Pobierz plik</a>
              </span>
            </div>
            {scriptError ? (
              <div className="editor-error">
                <p>{scriptError}</p>
                <button className="btn btn-ghost" onClick={loadScript}>Spróbuj ponownie</button>
              </div>
            ) : (
              <pre className="editor-code">{script ?? "Wczytuję kod agenta…"}</pre>
            )}
          </div>

          <DataScope mode="manual" />
        </section>
      )}
    </>
  );
}

/** How often to run the agent: a log-scale track from 10 minutes to 3 days with the sensible range marked. */
function Cadence() {
  // positions on a log scale 10 min .. 3 days
  const pos = (min: number) => `${((Math.log(min) - Math.log(10)) / (Math.log(4320) - Math.log(10))) * 100}%`;
  return (
    <figure className="cadence" aria-label="Jak często uruchamiać agenta">
      <figcaption>
        <b>Jak często?</b> Najlepiej co godzinę. Częściej niż co 30 minut nie ma sensu, bo agent wysyła tylko nowe dane,
        a rzadziej niż raz dziennie sprawi, że Twoje wyniki będą nieaktualne.
      </figcaption>
      <div className="cadence-track">
        <span className="zone ok" style={{ left: pos(30), width: `calc(${pos(1440)} - ${pos(30)})` }} />
        <span className="pin" style={{ left: pos(60) }} />
      </div>
      <div className="cadence-scale">
        <span className="far" style={{ left: 0 }}>za często</span>
        <span style={{ left: pos(30) }}>co 30 min</span>
        <span className="best" style={{ left: pos(60) }}>co godzinę<br /><small>zalecane</small></span>
        <span style={{ left: pos(1440) }}>raz dziennie</span>
        <span className="far end" style={{ right: 0 }}>za rzadko</span>
      </div>
    </figure>
  );
}

/** What the agent sends: always the numbers; prompt text and project names only when switched on. */
function DataScope({ mode }: { mode: "installer" | "manual" }) {
  const always = ["Czas pracy", "Tokeny", "Model", "Koszt", "Woda", "Przerwania i błędy"];
  const optional = [
    {
      name: "Treść promptów",
      how: mode === "manual" ? <code>shareText = $true</code> : "pole „Udostępniaj treść promptów”",
      off: "Bez niej nie będzie raportów z promptów: widok Prompty nie pokaże najczęstszych słów, sformułowań ani podglądu treści.",
    },
    {
      name: "Nazwy projektów",
      how: mode === "manual" ? <code>shareProjects = $true</code> : "pole „Udostępniaj nazwy projektów”",
      off: "Bez nich zobaczysz „projekt 1”, „projekt 2”… zamiast nazw folderów.",
    },
  ];
  return (
    <div className="scope">
      <div className="scope-col">
        <h3>Agent wysyła zawsze</h3>
        <ul className="chips">
          {always.map(a => <li key={a}>{a}</li>)}
        </ul>
        <p className="scope-note">Tylko liczby dla każdego promptu. Agent nic nie wyświetla i nie zapisuje raportów na komputerze.</p>
      </div>
      <div className="scope-col">
        <h3>Tylko gdy włączysz</h3>
        {optional.map(o => (
          <div key={o.name} className="opt">
            <span className="switch" aria-hidden><span /></span>
            <div>
              <b>{o.name}</b> <span className="opt-how">{o.how}</span>
              <p>{o.off}</p>
            </div>
          </div>
        ))}
        <p className="scope-note">Anonimizacja odbywa się na Twoim komputerze, zanim cokolwiek zostanie wysłane.</p>
      </div>
    </div>
  );
}
