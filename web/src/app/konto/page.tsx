import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, getSession } from "@/lib/auth";
import ApiKeys from "./ApiKeys";
import SignOut from "./SignOut";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ pusto?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/konto");
  const { pusto } = await searchParams;

  const { apiKeys } = await auth.api.listApiKeys({ headers: await headers() });
  const keys = apiKeys.map(k => ({
    id: k.id,
    name: k.name ?? "",
    start: k.start ?? "",
    createdAt: new Date(k.createdAt).toISOString(),
    lastRequest: k.lastRequest ? new Date(k.lastRequest).toISOString() : null,
  }));

  return (
    <>
      <header className="topnav">
        <span>💧 <b>Claude Water Tracker</b> · {session.user.name || session.user.email}</span>
        <nav>
          <Link href="/raport">Raport</Link>
          <Link href="/konto">Konto i klucze API</Link>
        </nav>
      </header>
      <main className="wrap">
        <h1>Konto</h1>
        <p className="sub">{session.user.email}</p>

        {pusto && (
          <div className="notice">
            Nie ma jeszcze żadnych danych na Twoim koncie. Utwórz klucz API poniżej i wyślij nim statystyki
            z komputera, na którym pracujesz z Claude Code. Potem raport pojawi się pod adresem /raport.
          </div>
        )}

        <section className="card">
          <h2>Klucze API</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Klucz łączy dane wysyłane z Twojego komputera z tym kontem. Serwer przechowuje tylko jego skrót,
            więc pełny klucz zobaczysz jeden raz, zaraz po utworzeniu. Każdy komputer może mieć osobny klucz.
          </p>
          <ApiKeys keys={keys} />
        </section>

        <section className="card">
          <h2>Sesja</h2>
          <SignOut />
        </section>
      </main>
    </>
  );
}
