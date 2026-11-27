"use client";
import { useState } from "react";
import { localeOf, pick, type Lang } from "@/lib/i18n";

export default function AgentKeyCard({ lang, ...props }: { lang: Lang; start: string; createdAt: string; lastRequest: string | null }) {
  const L = pick(lang);
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(localeOf(lang), { dateStyle: "long", timeStyle: "short" }) : L("jeszcze nie używany", "not used yet");
  const [k, setK] = useState(props);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rotate() {
    const ok = window.confirm(
      L(
        "Wygenerować nowy klucz?\n\nObecny klucz (i wszystkie starsze) przestanie działać od razu. Agent na Twoich komputerach przestanie wysyłać dane, dopóki nie pobierzesz i nie zainstalujesz go ponownie z zakładki Agent.",
        "Generate a new key?\n\nThe current key (and all older ones) stops working right away. The agent on your computers stops sending data until you download and install it again from the Agent page.",
      ),
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/agent/key", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(L("Nie udało się wygenerować nowego klucza.", "Could not generate a new key."));
      return;
    }
    const data = await res.json();
    setK({ start: data.start, createdAt: data.createdAt, lastRequest: null });
    setDone(true);
  }

  return (
    <>
      <dl className="facts">
        <dt>{L("Klucz", "Key")}</dt>
        <dd><code>{k.start}…</code></dd>
        <dt>{L("Utworzony", "Created")}</dt>
        <dd>{fmt(k.createdAt)}</dd>
        <dt>{L("Ostatnie użycie", "Last used")}</dt>
        <dd>{fmt(k.lastRequest)}</dd>
      </dl>
      {done && (
        <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>
          {L("Nowy klucz jest gotowy. Pobierz agenta ponownie w zakładce", "The new key is ready. Download the agent again on the")}{" "}
          <a href="/agent">Agent</a>{" "}
          {L("i zainstaluj go na swoich komputerach.", "page and install it on your computers.")}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-danger" onClick={rotate} disabled={busy}>
          {busy ? L("Generuję…", "Generating…") : L("Wygeneruj nowy klucz", "Generate a new key")}
        </button>
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    </>
  );
}
