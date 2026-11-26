import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/brand.mjs";
import { THEME_BOOT } from "@/lib/theme";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Ile wody zużyła Twoja praca z AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // the theme script sets data-theme before React loads, hence suppressHydrationWarning
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
