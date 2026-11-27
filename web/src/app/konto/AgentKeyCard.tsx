"use client";
import { useState } from "react";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" }) : "jeszcze nie używany";

export default function AgentKeyCard(props: { start: string; createdAt: string; lastRequest: string | null }) {
  const [k, setK] = useState(props);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rotate() {
    const ok = window.confirm(
      "Wygenerować nowy klucz?\n\n" +
        "Obecny klucz (i wszystkie starsze) przestanie działać od razu. Agent na Twoich komputerach " +
        "przestanie wysyłać dane, dopóki nie pobierzesz i nie zainstalujesz go ponownie z zakładki Agent.",
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/agent/klucz", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError("Nie udało się wygenerować nowego klucza.");
      return;
    }
    const data = await res.json();
    setK({ start: data.start, createdAt: data.createdAt, lastRequest: null });
    setDone(true);
  }

  return (
    <>
      <dl className="facts">
        <dt>Klucz</dt>
        <dd><code>{k.start}…</code></dd>
        <dt>Utworzony</dt>
        <dd>{fmt(k.createdAt)}</dd>
        <dt>Ostatnie użycie</dt>
        <dd>{fmt(k.lastRequest)}</dd>
      </dl>
      {done && (
        <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>
          Nowy klucz jest gotowy. Pobierz agenta ponownie w zakładce <a href="/agent">Agent</a> i zainstaluj go
          na swoich komputerach.
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-danger" onClick={rotate} disabled={busy}>
          {busy ? "Generuję…" : "Wygeneruj nowy klucz"}
        </button>
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    </>
  );
}
