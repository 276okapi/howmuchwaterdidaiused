// Frame for public pages (about, privacy policy): readable without signing in.
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand.mjs";
import { getL } from "@/lib/lang";
import LangSwitch from "./LangSwitch";
import "./public.css";

export default async function PublicShell({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  const { lang, L } = await getL();
  return (
    <div className="pub">
      <header className="pub-top">
        <Link href={session ? "/dashboard" : "/login"} className="pub-brand">
          <span className="pub-drop" aria-hidden />
          {APP_NAME}
        </Link>
        <nav className="pub-nav">
          <Link href="/about">{L("Co jest w środku", "What's inside")}</Link>
          <Link href="/privacy">{L("Polityka prywatności", "Privacy policy")}</Link>
          <LangSwitch lang={lang} />
          {session ? (
            <Link href="/dashboard" className="btn btn-primary">{L("Przejdź do raportu", "Go to your report")}</Link>
          ) : (
            <Link href="/login" className="btn btn-primary">{L("Zaloguj się", "Sign in")}</Link>
          )}
        </nav>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-foot">
        <span>{APP_NAME}</span>
        <Link href="/about">{L("Co jest w środku", "What's inside")}</Link>
        <Link href="/privacy">{L("Polityka prywatności", "Privacy policy")}</Link>
      </footer>
    </div>
  );
}
