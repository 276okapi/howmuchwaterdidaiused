import { headers } from "next/headers";
import { auth, getSession } from "@/lib/auth";
import { getAgentKey } from "@/lib/agent-key";
import AppShell from "@/components/AppShell";
import AgentKeyCard from "./AgentKeyCard";
import { getL } from "@/lib/lang";
import { localeOf } from "@/lib/i18n";

export const dynamic = "force-dynamic";


export default async function AccountPage() {
  const session = await getSession();
  const accounts = session ? await auth.api.listUserAccounts({ headers: await headers() }).catch(() => []) : [];
  const key = session ? await getAgentKey(session.user.id) : null;
  const { lang, L } = await getL();
  const PROVIDER: Record<string, string> = { credential: L("E-mail i hasło", "E-mail and password"), google: "Google", github: "GitHub" };

  return (
    <AppShell path="/account">
      <h1>{L("Konto", "Account")}</h1>
      <p className="sub">{L("Twoje dane, sposoby logowania i klucz agenta.", "Your details, sign-in methods and agent key.")}</p>
      {session && (
        <section className="card">
          <dl className="facts">
            <dt>{L("Nazwa", "Name")}</dt>
            <dd>{session.user.name || "–"}</dd>
            <dt>E-mail</dt>
            <dd>{session.user.email}</dd>
            <dt>{L("Logowanie", "Sign-in")}</dt>
            <dd>{accounts.map(a => PROVIDER[a.providerId] ?? a.providerId).join(", ") || "–"}</dd>
            <dt>{L("Konto od", "Member since")}</dt>
            <dd>{new Date(session.user.createdAt).toLocaleDateString(localeOf(lang), { dateStyle: "long" })}</dd>
          </dl>
        </section>
      )}
      {key && (
        <section className="card">
          <h2>{L("Klucz agenta", "Agent key")}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {L(
              "Ten klucz łączy agenta z Twoim kontem. Jest już wpisany w instalator i w kod agenta, które pobierasz w zakładce Agent. Jeśli ktoś mógł go poznać, wygeneruj nowy.",
              "This key links the agent to your account. It is already built into the installer and the agent code you download on the Agent page. If someone may have seen it, generate a new one.",
            )}
          </p>
          <AgentKeyCard
            lang={lang}
            start={key.start}
            createdAt={new Date(key.createdAt).toISOString()}
            lastRequest={key.lastRequest ? new Date(key.lastRequest).toISOString() : null}
          />
        </section>
      )}
    </AppShell>
  );
}
