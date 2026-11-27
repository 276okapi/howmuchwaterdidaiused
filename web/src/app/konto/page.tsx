import { headers } from "next/headers";
import { auth, getSession } from "@/lib/auth";
import { getAgentKey } from "@/lib/agent-key";
import AppShell from "@/components/AppShell";
import AgentKeyCard from "./AgentKeyCard";

export const dynamic = "force-dynamic";

const PROVIDER: Record<string, string> = { credential: "E-mail i hasło", google: "Google", github: "GitHub" };

export default async function AccountPage() {
  const session = await getSession();
  const accounts = session ? await auth.api.listUserAccounts({ headers: await headers() }).catch(() => []) : [];
  const key = session ? await getAgentKey(session.user.id) : null;

  return (
    <AppShell path="/konto">
      <h1>Konto</h1>
      <p className="sub">Twoje dane, sposoby logowania i klucz agenta.</p>
      {session && (
        <section className="card">
          <dl className="facts">
            <dt>Nazwa</dt>
            <dd>{session.user.name || "–"}</dd>
            <dt>E-mail</dt>
            <dd>{session.user.email}</dd>
            <dt>Logowanie</dt>
            <dd>{accounts.map(a => PROVIDER[a.providerId] ?? a.providerId).join(", ") || "–"}</dd>
            <dt>Konto od</dt>
            <dd>{new Date(session.user.createdAt).toLocaleDateString("pl-PL", { dateStyle: "long" })}</dd>
          </dl>
        </section>
      )}
      {key && (
        <section className="card">
          <h2>Klucz agenta</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Ten klucz łączy agenta z Twoim kontem. Jest już wpisany w instalator i w kod agenta, które pobierasz
            w zakładce Agent. Jeśli ktoś mógł go poznać, wygeneruj nowy.
          </p>
          <AgentKeyCard
            start={key.start}
            createdAt={new Date(key.createdAt).toISOString()}
            lastRequest={key.lastRequest ? new Date(key.lastRequest).toISOString() : null}
          />
        </section>
      )}
    </AppShell>
  );
}
