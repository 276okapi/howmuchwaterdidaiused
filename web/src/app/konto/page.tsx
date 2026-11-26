import { headers } from "next/headers";
import { auth, getSession } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

const PROVIDER: Record<string, string> = { credential: "E-mail i hasło", google: "Google", github: "GitHub" };

export default async function AccountPage() {
  const session = await getSession();
  const accounts = session ? await auth.api.listUserAccounts({ headers: await headers() }).catch(() => []) : [];

  return (
    <AppShell path="/konto">
      <h1>Konto</h1>
      <p className="sub">Twoje dane i sposoby logowania.</p>
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
    </AppShell>
  );
}
