"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { pick, type Lang, type L as LFn } from "@/lib/i18n";

const PROVIDER_LABEL: Record<string, string> = { google: "Google", github: "GitHub" };

// only same-site paths, never an absolute URL from the query string
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard");

type Provider = { id: string; enabled: boolean };

export default function AuthForm({ mode, providers, lang }: { mode: "login" | "register"; providers: Provider[]; lang: Lang }) {
  const L = pick(lang);
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const q = next === "/dashboard" ? "" : `?next=${encodeURIComponent(next)}`;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const register = mode === "register";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || "");
    const res = register
      ? await authClient.signUp.email({ email, password, name: String(f.get("name") || "").trim() || email.split("@")[0] })
      : await authClient.signIn.email({ email, password });
    if (res.error) {
      setBusy(false);
      setError(translate(L, res.error.code, res.error.message));
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function social(provider: string) {
    setError(null);
    const res = await authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: "/login" });
    if (res?.error) setError(translate(L, res.error.code, res.error.message));
  }

  return (
    <div className="auth-form">
      <nav className="auth-tabs" aria-label={L("Logowanie lub rejestracja", "Sign in or sign up")}>
        <Link href={`/login${q}`} aria-current={register ? undefined : "page"}>{L("Logowanie", "Sign in")}</Link>
        <Link href={`/register${q}`} aria-current={register ? "page" : undefined}>{L("Rejestracja", "Sign up")}</Link>
      </nav>

      <h2>{register ? L("Załóż konto", "Create an account") : L("Zaloguj się", "Sign in")}</h2>
      <p className="lead">
        {register
          ? L("Konto przypisuje statystyki z Twoich komputerów do Ciebie.", "Your account links the stats from your computers to you.")
          : L("Zobacz swój raport wody, kosztów i czasu pracy z AI.", "See your report of water, cost and time spent with AI.")}
      </p>

      {providers.length > 0 && (
        <>
          <div className="social">
            {providers.map(p => (
              <button
                key={p.id}
                type="button"
                className="btn btn-ghost btn-block"
                disabled={!p.enabled}
                title={p.enabled ? undefined : L("Brak konfiguracji OAuth", "OAuth is not configured")}
                onClick={() => social(p.id)}
              >
                {register ? L("Zarejestruj się przez", "Sign up with") : L("Zaloguj się przez", "Sign in with")} {PROVIDER_LABEL[p.id] ?? p.id}
              </button>
            ))}
          </div>
          {providers.some(p => !p.enabled) && (
            <p className="hint" style={{ marginTop: 8 }}>
              {L("Logowanie przez", "Signing in with")}{" "}
              {providers.filter(p => !p.enabled).map(p => PROVIDER_LABEL[p.id] ?? p.id).join(L(" i ", " and "))}{" "}
              {L("będzie dostępne po dodaniu kluczy OAuth w pliku web/.env.", "becomes available once OAuth keys are added to web/.env.")}
            </p>
          )}
          <div className="divider">{L("albo e-mailem", "or with e-mail")}</div>
        </>
      )}

      <form className="stack" onSubmit={onSubmit}>
        {register && (
          <label>
            {L("Nazwa wyświetlana", "Display name")}
            <input name="name" autoComplete="nickname" maxLength={60} placeholder={L("np. Kuba", "e.g. Alex")} />
          </label>
        )}
        <label>
          E-mail
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          {L("Hasło", "Password")}
          <span className="pw">
            <input
              name="password"
              type={showPw ? "text" : "password"}
              required
              minLength={register ? 10 : undefined}
              autoComplete={register ? "new-password" : "current-password"}
            />
            <button type="button" onClick={() => setShowPw(s => !s)} aria-pressed={showPw}>
              {showPw ? L("Ukryj", "Hide") : L("Pokaż", "Show")}
            </button>
          </span>
          {register && <span className="hint">{L("Co najmniej 10 znaków.", "At least 10 characters.")}</span>}
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {register && (
          <p className="consent">
            {L("Zakładając konto, akceptujesz", "By creating an account, you accept the")}{" "}
            <Link href="/privacy" target="_blank">{L("politykę prywatności", "privacy policy")}</Link>.
          </p>
        )}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? L("Chwila…", "One moment…") : register ? L("Załóż konto", "Create account") : L("Zaloguj się", "Sign in")}
        </button>
      </form>

      <p className="switch">
        {register ? (
          <>{L("Masz już konto?", "Already have an account?")} <Link href={`/login${q}`}>{L("Zaloguj się", "Sign in")}</Link></>
        ) : (
          <>{L("Pierwszy raz tutaj?", "New here?")} <Link href={`/register${q}`}>{L("Załóż konto", "Create an account")}</Link></>
        )}
      </p>
      <nav className="legal" aria-label={L("Informacje", "Information")}>
        <Link href="/about">{L("Co znajdziesz po zalogowaniu", "What you get after signing in")}</Link>
        <Link href="/privacy">{L("Polityka prywatności", "Privacy policy")}</Link>
      </nav>
    </div>
  );
}

function translate(L: LFn, code: string | undefined, fallback: string | undefined) {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD": return L("Nieprawidłowy e-mail lub hasło.", "Wrong e-mail or password.");
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": return L("Konto z tym adresem e-mail już istnieje. Zaloguj się.", "An account with this e-mail already exists. Sign in instead.");
    case "PASSWORD_TOO_SHORT": return L("Hasło musi mieć co najmniej 10 znaków.", "The password needs at least 10 characters.");
    case "PASSWORD_TOO_LONG": return L("Hasło jest za długie.", "The password is too long.");
    case "INVALID_EMAIL": return L("Nieprawidłowy adres e-mail.", "That e-mail address is not valid.");
    default: return fallback || L("Nie udało się. Spróbuj ponownie.", "That did not work. Try again.");
  }
}
