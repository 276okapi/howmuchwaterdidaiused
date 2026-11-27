// Language of the current request: the "lang" cookie (set by the switch), otherwise the
// browser's first language (Polish -> pl, anything else -> en).
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLang, pick, type Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(c)) return c;
  const first = ((await headers()).get("accept-language") || "").split(",")[0].trim().toLowerCase();
  return first.startsWith("pl") ? "pl" : "en";
}

export async function getL() {
  const lang = await getLang();
  return { lang, L: pick(lang) };
}
