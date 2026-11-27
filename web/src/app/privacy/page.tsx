import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import { getL } from "@/lib/lang";
import PolicyPl from "./policy-pl";
import PolicyEn from "./policy-en";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL();
  return { title: `${L("Polityka prywatności", "Privacy policy")} · howmuchwaterdidaiused` };
}

export default async function PrivacyPage() {
  const { lang } = await getL();
  return <PublicShell>{lang === "en" ? <PolicyEn /> : <PolicyPl />}</PublicShell>;
}
