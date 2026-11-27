// Frame for public pages (about, privacy policy): readable without signing in.
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand.mjs";
import "./public.css";

export default async function PublicShell({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  return (
    <div className="pub">
      <header className="pub-top">
        <Link href={session ? "/pulpit" : "/login"} className="pub-brand">
          <span className="pub-drop" aria-hidden />
          {APP_NAME}
        </Link>
        <nav className="pub-nav">
          <Link href="/o-serwisie">Co jest w środku</Link>
          <Link href="/prywatnosc">Polityka prywatności</Link>
          {session ? (
            <Link href="/pulpit" className="btn btn-primary">Przejdź do raportu</Link>
          ) : (
            <Link href="/login" className="btn btn-primary">Zaloguj się</Link>
          )}
        </nav>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-foot">
        <span>{APP_NAME}</span>
        <Link href="/o-serwisie">Co jest w środku</Link>
        <Link href="/prywatnosc">Polityka prywatności</Link>
      </footer>
    </div>
  );
}
