import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Water Tracker",
  description: "Ile wody zużyła Twoja praca z Claude",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
