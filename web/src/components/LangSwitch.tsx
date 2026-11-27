"use client";
// PL | EN switch: remembers the choice in a cookie and re-renders the page in that language.
import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";
import "./lang-switch.css";

export default function LangSwitch({ lang, className = "" }: { lang: Lang; className?: string }) {
  const router = useRouter();
  function choose(l: Lang) {
    if (l === lang) return;
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    // the report frame renders its texts on load, so it reloads in the new language
    document.querySelectorAll("iframe").forEach(f => {
      try { f.contentWindow?.location.reload(); } catch { /* not ours */ }
    });
    router.refresh();
  }
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={lang === "en" ? "Language" : "Język"}>
      {(["pl", "en"] as const).map(l => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => choose(l)}
          title={l === "pl" ? "Polski" : "English"}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
