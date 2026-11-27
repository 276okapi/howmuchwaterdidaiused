// Two languages: Polish and English. Texts sit next to each other as L("polski", "English"),
// so a missing translation is easy to spot. Safe to import in client components.
export type Lang = "pl" | "en";
export const LANG_COOKIE = "lang";
export type L = <T>(pl: T, en: T) => T;

export const isLang = (v: unknown): v is Lang => v === "pl" || v === "en";
export const pick = (lang: Lang): L => (pl, en) => (lang === "en" ? en : pl);
export const localeOf = (lang: Lang) => (lang === "en" ? "en-US" : "pl-PL");
