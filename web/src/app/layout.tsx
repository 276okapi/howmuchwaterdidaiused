import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/brand.mjs";
import { THEME_BOOT } from "@/lib/theme";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    title: APP_NAME,
    description: lang === "en" ? "How much water did your AI work use" : "Ile wody zużyła Twoja praca z AI",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // the theme script sets data-theme before React loads, hence suppressHydrationWarning
    <html lang={await getLang()} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
