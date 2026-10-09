import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

import { getClientEnv } from "@/config/env";
import { AppFreshness } from "@/components/shared/app-freshness";

// IBM Plex Sans Thai covers both Thai and Latin glyphs in one family, so the
// UI renders correctly for the Thai-first audience without a separate
// fallback font swap for Thai text (Step 12: Thai-compatible typography).
const bodyFont = IBM_Plex_Sans_Thai({
  variable: "--font-sans",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

const DESCRIPTION =
  "ระบบการเงินส่วนบุคคลที่ช่วยให้ผู้ใช้รู้สถานะทางการเงิน ควบคุมเงิน วางแผน เพิ่มรายได้ และสร้างความมั่งคั่ง — Know your money. Grow your income. Build your wealth.";

/** iPhone portrait screens [css width, css height, pixel ratio]; files in public/splash. */
const SPLASH_SCREENS: ReadonlyArray<readonly [number, number, number]> = [
  [440, 956, 3],
  [430, 932, 3],
  [428, 926, 3],
  [414, 896, 3],
  [414, 896, 2],
  [402, 874, 3],
  [393, 852, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 736, 3],
  [375, 667, 2],
];

/**
 * Day 8 STEP 11 (SEO/metadata). This is the DEFAULT for every route —
 * public pages (`/`, `/pricing`, `/login`, `/signup`) inherit it as-is and
 * are indexable. The authenticated `(app)` route group overrides `robots`
 * to noindex (see `src/app/(app)/layout.tsx`) — financial dashboards have
 * no business appearing in search results, and there is nothing there a
 * search engine could usefully index anyway (every page requires a session).
 */
export const metadata: Metadata = {
  metadataBase: new URL(getClientEnv().NEXT_PUBLIC_APP_URL),
  title: { default: "Wealth OS", template: "%s — Wealth OS" },
  description: DESCRIPTION,
  openGraph: {
    title: "Wealth OS",
    description: DESCRIPTION,
    siteName: "Wealth OS",
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wealth OS",
    description: DESCRIPTION,
  },
  // iOS home-screen launch: without startup images iOS shows a blank white
  // screen while the app loads. These are the closed journal on the desk
  // (screenshots of LaunchStillScene), so a launch goes launch image ->
  // the same closed journal in the page -> the journal opening.
  appleWebApp: {
    capable: true,
    title: "Wealth OS",
    statusBarStyle: "default",
    startupImage: SPLASH_SCREENS.map(([w, h, dpr]) => ({
      url: `/splash/iphone-${w * dpr}x${h * dpr}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
    })),
  },
  // Next emits only the generic "mobile-web-app-capable"; iOS reads the
  // startup images above only alongside the apple-prefixed one.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8f6",
  // Required for `env(safe-area-inset-*)` to resolve to a real value on
  // notched iPhones (BottomNav's pb-[env(safe-area-inset-bottom)]) —
  // without "cover", Safari never lets the page extend under the safe
  // area, so those env() vars stay 0 and the padding silently does
  // nothing. (Nav/PWA audit: this was previously added, then lost as a
  // side effect of reverting an unrelated redesign commit that happened
  // to be bundled with it — confirmed missing at HEAD before this fix.)
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${bodyFont.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AppFreshness />
          {children}
        </ThemeProvider>
        {/* Real-user load timings (Core Web Vitals) per route in the Vercel
            dashboard — only timing metrics and the route pattern (dynamic
            segments stay as [id]), never page content or financial data. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
