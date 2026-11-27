"use client";
// Slide-out menu on the left: one item per feature, sign-out at the very bottom.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { APP_NAME } from "@/lib/brand.mjs";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import { pick, type Lang, type L as LFn } from "@/lib/i18n";
import LangSwitch from "./LangSwitch";

type Item = { href: string; label: string; icon: React.ReactNode };

const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// groups of menu items; a group with a title is shown under a small heading
const groups = (L: LFn): { title?: string; items: Item[] }[] => [
  {
    items: [
      {
        href: "/dashboard",
        label: L("Pulpit", "Dashboard"),
        icon: <svg {...ICON}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
      },
    ],
  },
  {
    title: L("Raporty", "Reports"),
    items: [
      {
        href: "/days",
        label: L("Dni", "Days"),
        icon: <svg {...ICON}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
      },
      {
        href: "/prompts",
        label: L("Prompty", "Prompts"),
        icon: <svg {...ICON}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></svg>,
      },
    ],
  },
  {
    items: [
      {
        href: "/agent",
        label: "Agent",
        icon: <svg {...ICON}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M12 7v5M9.5 9.5 12 12l2.5-2.5" /></svg>,
      },
      {
        href: "/account",
        label: L("Konto", "Account"),
        icon: <svg {...ICON}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>,
      },
    ],
  },
];

const themes = (L: LFn): { t: ThemePref; label: string; icon: React.ReactNode }[] => [
  { t: "auto", label: L("Motyw jak w systemie", "Theme: follow system"), icon: <svg {...ICON}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg> },
  { t: "light", label: L("Motyw jasny", "Light theme"), icon: <svg {...ICON}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg> },
  { t: "dark", label: L("Motyw ciemny", "Dark theme"), icon: <svg {...ICON}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg> },
];

export default function SideMenu({ name, email, lang }: { name: string; email: string; lang: Lang }) {
  const L = pick(lang);
  const GROUPS = groups(L);
  const ITEMS = GROUPS.flatMap(g => g.items);
  const THEMES = themes(L);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<ThemePref>("auto");
  useEffect(() => setTheme(getThemePref()), []);
  function chooseTheme(t: ThemePref) {
    setTheme(t);
    setThemePref(t);
  }
  const pathname = usePathname();
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // close after navigating
  useEffect(() => setOpen(false), [pathname]);

  // Esc closes; focus goes into the menu when it opens and back to the button when it closes
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const current = ITEMS.find(i => pathname.startsWith(i.href));

  return (
    <>
      <header className="app-top">
        <button
          ref={toggleRef}
          className="app-burger"
          aria-expanded={open}
          aria-controls="app-menu"
          aria-label={open ? L("Zamknij menu", "Close menu") : L("Otwórz menu", "Open menu")}
          onClick={() => setOpen(o => !o)}
        >
          <span /><span /><span />
        </button>
        <span className="app-title">{current?.label ?? APP_NAME}</span>
      </header>

      <div className={open ? "app-scrim show" : "app-scrim"} onClick={() => setOpen(false)} aria-hidden />

      <nav id="app-menu" ref={panelRef} className={open ? "app-menu open" : "app-menu"} aria-label="Menu" inert={!open}>
        <div className="app-brand">
          <span className="app-drop" aria-hidden />
          {APP_NAME}
        </div>
        <div className="app-user">
          <b>{name}</b>
          <span>{email}</span>
        </div>

        {GROUPS.map((g, gi) => (
          <div key={gi} className="app-group">
            {g.title && <p className="app-group-title">{g.title}</p>}
            <ul className="app-items">
              {g.items.map(i => (
                <li key={i.href}>
                  <Link href={i.href} aria-current={pathname.startsWith(i.href) ? "page" : undefined}>
                    {i.icon}
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="app-bottom">
          <div className="app-legal-row">
            <nav className="app-legal" aria-label={L("Informacje", "Information")}>
              <Link href="/about">{L("Co jest w serwisie", "What's inside")}</Link>
              <Link href="/privacy">{L("Polityka prywatności", "Privacy policy")}</Link>
            </nav>
            <LangSwitch lang={lang} />
          </div>
          <hr />
          <div className="app-bottom-row">
            <button className="app-signout" onClick={signOut} disabled={busy}>
              <svg {...ICON}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" /></svg>
              {busy ? L("Wylogowuję…", "Signing out…") : L("Wyloguj", "Sign out")}
            </button>
            <div className="app-theme" role="group" aria-label={L("Motyw", "Theme")}>
              {THEMES.map(o => (
                <button key={o.t} title={o.label} aria-label={o.label} aria-pressed={theme === o.t} onClick={() => chooseTheme(o.t)}>
                  {o.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
