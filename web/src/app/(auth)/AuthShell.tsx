// Two-column frame for sign-in / sign-up: the left side is a measuring jug that fills
// with water once on page load, with a few words about the app; the form goes right.
import { APP_NAME } from "@/lib/brand.mjs";
import { getL } from "@/lib/lang";
import { localeOf, type Lang } from "@/lib/i18n";
import LangSwitch from "@/components/LangSwitch";

// one wave period is 600 units wide; the path holds two periods so it can loop by -50%
const WAVE = "M0 30 C150 0 150 60 300 30 S450 0 600 30 S750 60 900 30 S1050 0 1200 30 V80 H0 Z";

// jug graduations every 60 px from the bottom, a label every 0,5 l
const STEP = 60;
const marks = (lang: Lang) => Array.from({ length: 18 }, (_, i) => {
  const n = i + 1;
  return { bottom: n * STEP, label: n % 2 === 0 ? `${(n / 4).toLocaleString(localeOf(lang))} l` : null };
});

function Scale({ className, lang }: { className: string; lang: Lang }) {
  const MARKS = marks(lang);
  return (
    <div className={className} aria-hidden>
      {MARKS.map(m => (
        <div key={m.bottom} className={m.label ? "mark major" : "mark"} style={{ bottom: m.bottom }}>
          {m.label && <span>{m.label}</span>}
        </div>
      ))}
    </div>
  );
}

export default async function AuthShell({ children }: { children: React.ReactNode }) {
  const { lang, L } = await getL();
  return (
    <div className="auth">
      <aside className="auth-jug" aria-label={L("O aplikacji", "About the app")}>
        <div className="auth-brand">
          <span className="auth-drop" aria-hidden />
          {APP_NAME}
        </div>

        <div className="auth-pitch">
          <h1>{L(<>Ile wody zużyła Twoja praca z&nbsp;AI?</>, <>How much water did your AI work&nbsp;use?</>)}</h1>
          <p>
            {L(
              "Każdy prompt to praca serwerów, a serwery chłodzi się wodą. Tracker liczy tokeny zużyte przez asystentów AI na Twoim komputerze i zamienia je na szacunkowe litry, koszt i czas pracy agenta.",
              "Every prompt keeps servers busy, and servers are cooled with water. The tracker counts the tokens your AI assistants use on your computer and turns them into estimated litres, cost and agent time.",
            )}
          </p>
          <ul>
            <li>{L("Treść promptów zostaje u Ciebie. Na serwer trafiają tylko liczby.", "Your prompts stay with you. Only numbers reach the server.")}</li>
            <li>{L("Jeden przelicznik dla wszystkich, więc wyniki da się uczciwie porównać.", "One conversion rate for everyone, so results compare fairly.")}</li>
            <li>{L("Raport dzień po dniu: prompty, tokeny, koszt i woda.", "A day-by-day report: prompts, tokens, cost and water.")}</li>
          </ul>
        </div>

        <Scale className="auth-scale" lang={lang} />

        <div className="auth-water" aria-hidden>
          <svg className="wave back" viewBox="0 0 1200 80" preserveAspectRatio="none">
            <path d={WAVE} />
          </svg>
          <svg className="wave front" viewBox="0 0 1200 80" preserveAspectRatio="none">
            <path d={WAVE} />
          </svg>
          <div className="auth-body" />
          {/* the same scale again, white, visible only under water */}
          <Scale className="auth-scale under" lang={lang} />
          <p className="auth-note">{L("Przyjmujemy ok. 100 l wody na milion tokenów odpowiedzi modelu. To szacunek.", "We assume about 100 l of water per million output tokens. It is an estimate.")}</p>
        </div>
      </aside>

      <main className="auth-panel">
        <LangSwitch lang={lang} className="auth-lang" />
        {children}
      </main>
    </div>
  );
}
