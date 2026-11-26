"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const PROVIDER_LABEL: Record<string, string> = { google: "Google", github: "GitHub" };

// only same-site paths, never an absolute URL from the query string
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/raport");

export default function AuthForm({ mode, providers }: { mode: "login" | "register"; providers: string[] }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || "");
    const res =
      mode === "register"
        ? await authClient.signUp.email({ email, password, name: String(f.get("name") || "").trim() || email.split("@")[0] })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
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
    <div className="narrow">
      <p className="muted" style={{ margin: "0 0 6px" }}>💧 Claude Water Tracker</p>
      <h1>{mode === "login" ? "Zaloguj się" : "Załóż konto"}</h1>
      <p className="sub">
        {mode === "login" ? "Twój raport zużycia wody i kosztów pracy z Claude." : "Konto jest potrzebne, żeby wysyłać statystyki z własnego komputera."}
      </p>
      <div className="card">
        {providers.length > 0 && (
          <>
            <div className="social">
              {providers.map(p => (
                <button key={p} type="button" className="btn btn-ghost btn-block" onClick={() => social(p)}>
                  {mode === "login" ? "Zaloguj przez" : "Zarejestruj przez"} {PROVIDER_LABEL[p] ?? p}
                </button>
              ))}
            </div>
            <div className="divider">albo e-mailem</div>
          </>
        )}
        <form className="stack" onSubmit={onSubmit}>
          {mode === "register" && (
            <label>
              Nazwa wyświetlana
              <input name="name" autoComplete="nickname" maxLength={60} />
            </label>
          )}
          <label>
            E-mail
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Hasło
            <input
              name="password"
              type="password"
              required
              minLength={mode === "register" ? 10 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Chwila…" : mode === "login" ? "Zaloguj się" : "Załóż konto"}
          </button>
        </form>
      </div>
      <p className="muted" style={{ textAlign: "center" }}>
        {mode === "login" ? (
          <>Nie masz konta? <Link href={`/register?next=${encodeURIComponent(next)}`}>Zarejestruj się</Link></>
        ) : (
          <>Masz już konto? <Link href={`/login?next=${encodeURIComponent(next)}`}>Zaloguj się</Link></>
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
    default: return fallback || "Coś poszło nie tak. Spróbuj ponownie.";
  }
}
