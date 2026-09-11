import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

import { getClientEnv } from "@/config/env";

// IBM Plex Sans Thai covers both Thai and Latin glyphs in one family, so the
// UI renders correctly for the Thai-first audience without a separate
// fallback font swap for Thai text (Step 12: Thai-compatible typography).
const bodyFont = IBM_Plex_Sans_Thai({
  variable: "--font-sans",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getClientEnv().NEXT_PUBLIC_APP_URL),
  title: "Wealth OS",
  description: "Your personal finance operating system.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${bodyFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
