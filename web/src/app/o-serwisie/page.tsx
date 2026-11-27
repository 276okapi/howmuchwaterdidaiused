import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Co znajdziesz po zalogowaniu · howmuchwaterdidaiused" };

const I = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const FEATURES = [
  {
    name: "Pulpit",
    icon: <svg {...I}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
    text: "Wszystko najważniejsze na jednym ekranie.",
    points: [
      "liczba promptów, aktywne dni, czas pracy agenta i szacowany koszt",
      "ile wody zużyła Twoja praca, w litrach i butelkach",
      "kalendarz aktywności i wykres promptów dzień po dniu",
      "zestawienie projektów",
    ],
  },
  {
    name: "Dni",
    icon: <svg {...I}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
    text: "Szczegóły wybranego dnia.",
    points: [
      "oś czasu: od wysłania promptu do ostatniej odpowiedzi",
      "lista promptów dnia z czasem, tokenami, kosztem i wodą",
      "przerwania, błędy i prompty, które trzeba było poprawiać",
    ],
  },
  {
    name: "Prompty",
    icon: <svg {...I}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></svg>,
    text: "Jak piszesz do asystenta.",
    points: [
      "najczęstsze słowa i sformułowania",
      "pytania, wklejki, pory dnia",
      "statystyki tekstu działają tylko wtedy, gdy udostępnisz treść promptów",
    ],
  },
  {
    name: "Agent",
    icon: <svg {...I}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M12 7v5M9.5 9.5 12 12l2.5-2.5" /></svg>,
    text: "Mały program, który zbiera dane z Twojego komputera.",
    points: [
      "instalator dla Windows albo kod do skopiowania",
      "sam wybierasz, jak często wysyła dane",
      "treść promptów i nazwy projektów tylko za Twoją zgodą",
    ],
  },
  {
    name: "Konto",
    icon: <svg {...I}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>,
    text: "Twoje dane i bezpieczeństwo.",
    points: [
      "logowanie e-mailem, przez Google albo GitHub",
      "klucz agenta i jego wymiana, jeśli wyciekł",
      "motyw jasny, ciemny albo jak w systemie",
    ],
  },
];

export default async function AboutPage() {
  const session = await getSession().catch(() => null);
  return (
    <PublicShell>
      <section className="about-hero">
        <h1>Ile wody zużyła Twoja praca z AI?</h1>
        <p>
          Każdy prompt to praca serwerów, a serwery chłodzi się wodą. Po zalogowaniu zobaczysz, ile pracowałeś
          z asystentem AI, ile to kosztowało i ile wody na to poszło, dzień po dniu.
        </p>
      </section>

      <ol className="about-steps">
        <li><b>Załóż konto</b><span>E-mailem albo przez Google lub GitHub.</span></li>
        <li><b>Zainstaluj agenta</b><span>Na komputerze, na którym pracujesz z asystentem. Zajmuje to minutę.</span></li>
        <li><b>Oglądaj raport</b><span>Agent wysyła dane w tle, a raport aktualizuje się sam.</span></li>
      </ol>

      <h2 className="about-h2">Co znajdziesz po zalogowaniu</h2>
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
          <Link className="btn btn-primary" href="/pulpit">Przejdź do raportu</Link>
        ) : (
          <>
            <Link className="btn btn-primary" href="/register">Załóż konto</Link>
            <Link className="btn btn-ghost" href="/login">Zaloguj się</Link>
          </>
        )}
        <Link className="btn btn-ghost" href="/prywatnosc">Polityka prywatności</Link>
      </div>
    </PublicShell>
  );
}
