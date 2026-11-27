import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import { getSession } from "@/lib/auth";
import { getL } from "@/lib/lang";
import type { L as LFn } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL();
  return { title: `${L("Co znajdziesz po zalogowaniu", "What you get after signing in")} · howmuchwaterdidaiused` };
}

const I = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const features = (L: LFn) => [
  {
    name: L("Pulpit", "Dashboard"),
    icon: <svg {...I}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
    text: L("Wszystko najważniejsze na jednym ekranie.", "Everything important on one screen."),
    points: [
      L("liczba promptów, aktywne dni, czas pracy agenta i szacowany koszt", "prompts, active days, agent time and estimated cost"),
      L("ile wody zużyła Twoja praca, w litrach i butelkach", "how much water your work used, in litres and bottles"),
      L("kalendarz aktywności i wykres promptów dzień po dniu", "an activity calendar and a day-by-day prompt chart"),
      L("zestawienie projektów", "a breakdown by project"),
    ],
  },
  {
    name: L("Dni", "Days"),
    icon: <svg {...I}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
    text: L("Szczegóły wybranego dnia.", "The details of any day."),
    points: [
      L("oś czasu: od wysłania promptu do ostatniej odpowiedzi", "a timeline: from sending a prompt to the last answer"),
      L("lista promptów dnia z czasem, tokenami, kosztem i wodą", "the day's prompts with time, tokens, cost and water"),
      L("przerwania, błędy i prompty, które trzeba było poprawiać", "interruptions, errors and prompts you had to correct"),
    ],
  },
  {
    name: L("Prompty", "Prompts"),
    icon: <svg {...I}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></svg>,
    text: L("Jak piszesz do asystenta.", "How you write to your assistant."),
    points: [
      L("najczęstsze słowa i sformułowania", "your most common words and phrases"),
      L("pytania, wklejki, pory dnia", "questions, pasted text, time of day"),
      L("statystyki tekstu działają tylko wtedy, gdy udostępnisz treść promptów", "text stats work only if you share your prompt text"),
    ],
  },
  {
    name: "Agent",
    icon: <svg {...I}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M12 7v5M9.5 9.5 12 12l2.5-2.5" /></svg>,
    text: L("Mały program, który zbiera dane z Twojego komputera.", "A small program that collects data on your computer."),
    points: [
      L("instalator dla Windows albo kod do skopiowania", "a Windows installer or code to copy"),
      L("sam wybierasz, jak często wysyła dane", "you choose how often it sends data"),
      L("treść promptów i nazwy projektów tylko za Twoją zgodą", "prompt text and project names only with your consent"),
    ],
  },
  {
    name: L("Konto", "Account"),
    icon: <svg {...I}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>,
    text: L("Twoje dane i bezpieczeństwo.", "Your details and security."),
    points: [
      L("logowanie e-mailem, przez Google albo GitHub", "sign in with e-mail, Google or GitHub"),
      L("klucz agenta i jego wymiana, jeśli wyciekł", "your agent key, and replacing it if it leaks"),
      L("motyw jasny, ciemny albo jak w systemie", "light, dark or system theme"),
    ],
  },
];

export default async function AboutPage() {
  const session = await getSession().catch(() => null);
  const { L } = await getL();
  const FEATURES = features(L);
  return (
    <PublicShell>
      <section className="about-hero">
        <h1>{L("Ile wody zużyła Twoja praca z AI?", "How much water did your AI work use?")}</h1>
        <p>
          {L(
            "Każdy prompt to praca serwerów, a serwery chłodzi się wodą. Po zalogowaniu zobaczysz, ile pracowałeś z asystentem AI, ile to kosztowało i ile wody na to poszło, dzień po dniu.",
            "Every prompt keeps servers busy, and servers are cooled with water. After signing in you see how much you worked with your AI assistant, what it cost and how much water it took, day by day.",
          )}
        </p>
      </section>

      <ol className="about-steps">
        <li><b>{L("Załóż konto", "Create an account")}</b><span>{L("E-mailem albo przez Google lub GitHub.", "With e-mail, Google or GitHub.")}</span></li>
        <li><b>{L("Zainstaluj agenta", "Install the agent")}</b><span>{L("Na komputerze, na którym pracujesz z asystentem. Zajmuje to minutę.", "On the computer where you work with your assistant. It takes a minute.")}</span></li>
        <li><b>{L("Oglądaj raport", "Watch your report")}</b><span>{L("Agent wysyła dane w tle, a raport aktualizuje się sam.", "The agent sends data in the background and the report updates itself.")}</span></li>
      </ol>

      <h2 className="about-h2">{L("Co znajdziesz po zalogowaniu", "What you get after signing in")}</h2>
      <div className="features">
        {FEATURES.map(f => (
          <article key={f.name} className="feature">
            <div className="feature-head">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.name}</h3>
            </div>
            <p>{f.text}</p>
            <ul>{f.points.map(p => <li key={p}>{p}</li>)}</ul>
          </article>
        ))}
      </div>

      <div className="about-cta">
        {session ? (
          <Link className="btn btn-primary" href="/dashboard">{L("Przejdź do raportu", "Go to your report")}</Link>
        ) : (
          <>
            <Link className="btn btn-primary" href="/register">{L("Załóż konto", "Create an account")}</Link>
            <Link className="btn btn-ghost" href="/login">{L("Zaloguj się", "Sign in")}</Link>
          </>
        )}
        <Link className="btn btn-ghost" href="/privacy">{L("Polityka prywatności", "Privacy policy")}</Link>
      </div>
    </PublicShell>
  );
}
