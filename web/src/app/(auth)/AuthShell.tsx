// Two-column frame for sign-in / sign-up: the left side is a measuring jug that fills
// with water once on page load, with a few words about the app; the form goes right.
import { APP_NAME } from "@/lib/brand.mjs";

// one wave period is 600 units wide; the path holds two periods so it can loop by -50%
const WAVE = "M0 30 C150 0 150 60 300 30 S450 0 600 30 S750 60 900 30 S1050 0 1200 30 V80 H0 Z";

// jug graduations every 60 px from the bottom, a label every 0,5 l
const STEP = 60;
const MARKS = Array.from({ length: 18 }, (_, i) => {
  const n = i + 1;
  return { bottom: n * STEP, label: n % 2 === 0 ? `${(n / 4).toLocaleString("pl-PL")} l` : null };
});

function Scale({ className }: { className: string }) {
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

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-jug" aria-label="O aplikacji">
        <div className="auth-brand">
          <span className="auth-drop" aria-hidden />
          {APP_NAME}
        </div>

        <div className="auth-pitch">
          <h1>Ile wody zużyła Twoja praca z&nbsp;AI?</h1>
          <p>
            Każdy prompt to praca serwerów, a serwery chłodzi się wodą. Tracker liczy tokeny
            zużyte przez asystentów AI na Twoim komputerze i zamienia je na szacunkowe litry,
            koszt i czas pracy agenta.
          </p>
          <ul>
            <li>Treść promptów zostaje u Ciebie. Na serwer trafiają tylko liczby.</li>
            <li>Jeden przelicznik dla wszystkich, więc wyniki da się uczciwie porównać.</li>
            <li>Raport dzień po dniu: prompty, tokeny, koszt i woda.</li>
          </ul>
        </div>

        <Scale className="auth-scale" />

        <div className="auth-water" aria-hidden>
          <svg className="wave back" viewBox="0 0 1200 80" preserveAspectRatio="none">
            <path d={WAVE} />
          </svg>
          <svg className="wave front" viewBox="0 0 1200 80" preserveAspectRatio="none">
            <path d={WAVE} />
          </svg>
          <div className="auth-body" />
          {/* the same scale again, white, visible only under water */}
          <Scale className="auth-scale under" />
          <p className="auth-note">Przyjmujemy ok. 100 l wody na milion tokenów odpowiedzi modelu. To szacunek.</p>
        </div>
      </aside>

      <main className="auth-panel">{children}</main>
    </div>
  );
}
