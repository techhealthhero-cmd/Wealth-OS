import type { MetadataRoute } from "next";

/**
 * PWA manifest (Day 8 STEP 10). Makes WEALTH OS installable on mobile/
 * desktop home screens. Deliberately no service worker alongside this —
 * see the file-level note in `src/app/layout.tsx`'s metadata and
 * PROJECT_STATUS.md's "PWA" section for why: this app's entire value is
 * live financial/billing/AI state, and a service worker that caches it
 * risks showing a stale balance, a stale plan, or a stale AI reply as if it
 * were current. Installability without offline support is the honest
 * feature to ship; pretending offline mode works when it doesn't would
 * violate this app's "do not create fake successful integrations" rule.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wealth OS — Know your money. Grow your income. Build your wealth.",
    short_name: "Wealth OS",
    description: "ระบบการเงินส่วนบุคคลที่ช่วยให้ผู้ใช้รู้สถานะทางการเงิน ควบคุมเงิน วางแผน เพิ่มรายได้ และสร้างความมั่งคั่ง",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f8f6",
    // Matches the app's actual brand green (--primary, #1F4D3E) and the
    // root layout's own viewport themeColor — the previous #2a78d6 (blue)
    // was a leftover from an earlier design direction the app moved away
    // from; an installed PWA's OS status bar/task-switcher chrome would
    // have shown a jarring blue that doesn't match the app at all.
    theme_color: "#1F4D3E",
    lang: "th",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
