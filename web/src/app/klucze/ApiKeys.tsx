"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Key = { id: string; name: string; start: string; createdAt: string; lastRequest: string | null };

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" }) : "nigdy";

export default function ApiKeys({ keys }: { keys: Key[] }) {
  const router = useRouter();
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name") || "").trim() || "Mój komputer";
    setBusy(true);
    setError(null);
    const res = await authClient.apiKey.create({ name });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error?.message || "Nie udało się utworzyć klucza.");
      return;
    }
    setCreated(res.data.key);
    setCopied(false);
    form.reset();
    router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Usunąć klucz „${name}”? Komputer, który go używa, przestanie wysyłać dane.`)) return;
    const res = await authClient.apiKey.delete({ keyId: id });
    if (res.error) setError(res.error.message || "Nie udało się usunąć klucza.");
    router.refresh();
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <>
      {created && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: "0 0 6px" }}><b>Nowy klucz.</b> Skopiuj go teraz, później nie będzie można go wyświetlić.</p>
          <div className="newkey">
            <code style={{ flex: 1 }}>{created}</code>
            <button
              className="btn btn-ghost"
              onClick={() => navigator.clipboard.writeText(created).then(() => setCopied(true))}
            >
              {copied ? "Skopiowano" : "Kopiuj"}
            </button>
          </div>
          <p className="muted" style={{ margin: "10px 0 4px" }}>Wysyłanie danych z lokalnego raportu (z folderu repozytorium):</p>
          <pre>{`cd web
node scripts/import-raport.mjs --url ${origin} --key ${created} ../raport.html`}</pre>
        </div>
      )}

      {keys.length > 0 ? (
        <table className="keys">
          <thead>
            <tr><th>Nazwa</th><th>Klucz</th><th>Utworzony</th><th>Ostatnie użycie</th><th /></tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td className="mono">{k.start}…</td>
                <td>{fmt(k.createdAt)}</td>
                <td>{fmt(k.lastRequest)}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-danger" onClick={() => remove(k.id, k.name)}>Usuń</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Nie masz jeszcze żadnego klucza.</p>
      )}

      <form className="row" style={{ marginTop: 14 }} onSubmit={create}>
        <label>
          Nazwa nowego klucza
          <input name="name" placeholder="np. Laptop służbowy" maxLength={60} />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Tworzę…" : "Utwórz klucz"}</button>
      </form>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </>
  );
}
