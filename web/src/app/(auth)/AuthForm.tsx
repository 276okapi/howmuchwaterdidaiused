"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const PROVIDER_LABEL: Record<string, string> = { google: "Google", github: "GitHub" };

// only same-site paths, never an absolute URL from the query string
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/pulpit");

type Provider = { id: string; enabled: boolean };

export default function AuthForm({ mode, providers }: { mode: "login" | "register"; providers: Provider[] }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const q = next === "/pulpit" ? "" : `?next=${encodeURIComponent(next)}`;
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
      setError(translate(res.error.code, res.error.message));
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function social(provider: string) {
    setError(null);
    const res = await authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: "/login" });
    if (res?.error) setError(translate(res.error.code, res.error.message));
  }

  return (
    <div className="auth-form">
      <nav className="auth-tabs" aria-label="Logowanie lub rejestracja">
        <Link href={`/login${q}`} aria-current={register ? undefined : "page"}>Logowanie</Link>
        <Link href={`/register${q}`} aria-current={register ? "page" : undefined}>Rejestracja</Link>
      </nav>

      <h2>{register ? "Załóż konto" : "Zaloguj się"}</h2>
      <p className="lead">
        {register
          ? "Konto przypisuje statystyki z Twoich komputerów do Ciebie."
          : "Zobacz swój raport wody, kosztów i czasu pracy z AI."}
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
                title={p.enabled ? undefined : "Brak konfiguracji OAuth"}
                onClick={() => social(p.id)}
              >
                {register ? "Zarejestruj się przez" : "Zaloguj się przez"} {PROVIDER_LABEL[p.id] ?? p.id}
              </button>
            ))}
          </div>
          {providers.some(p => !p.enabled) && (
            <p className="hint" style={{ marginTop: 8 }}>
              Logowanie przez {providers.filter(p => !p.enabled).map(p => PROVIDER_LABEL[p.id] ?? p.id).join(" i ")} będzie
              dostępne po dodaniu kluczy OAuth w pliku web/.env.
            </p>
          )}
          <div className="divider">albo e-mailem</div>
        </>
      )}

      <form className="stack" onSubmit={onSubmit}>
        {register && (
          <label>
            Nazwa wyświetlana
            <input name="name" autoComplete="nickname" maxLength={60} placeholder="np. Kuba" />
          </label>
        )}
        <label>
          E-mail
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Hasło
          <span className="pw">
            <input
              name="password"
              type={showPw ? "text" : "password"}
              required
              minLength={register ? 10 : undefined}
              autoComplete={register ? "new-password" : "current-password"}
            />
            <button type="button" onClick={() => setShowPw(s => !s)} aria-pressed={showPw}>
              {showPw ? "Ukryj" : "Pokaż"}
            </button>
          </span>
          {register && <span className="hint">Co najmniej 10 znaków.</span>}
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Chwila…" : register ? "Załóż konto" : "Zaloguj się"}
        </button>
      </form>

      <p className="switch">
        {register ? (
          <>Masz już konto? <Link href={`/login${q}`}>Zaloguj się</Link></>
        ) : (
          <>Pierwszy raz tutaj? <Link href={`/register${q}`}>Załóż konto</Link></>
        )}
      </p>
    </div>
  );
}

function translate(code: string | undefined, fallback: string | undefined) {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD": return "Nieprawidłowy e-mail lub hasło.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": return "Konto z tym adresem e-mail już istnieje. Zaloguj się.";
    case "PASSWORD_TOO_SHORT": return "Hasło musi mieć co najmniej 10 znaków.";
    case "PASSWORD_TOO_LONG": return "Hasło jest za długie.";
    case "INVALID_EMAIL": return "Nieprawidłowy adres e-mail.";
    default: return fallback || "Nie udało się. Spróbuj ponownie.";
  }
}
