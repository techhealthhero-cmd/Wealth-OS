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
    background_color: "#ffffff",
    theme_color: "#2a78d6",
    lang: "th",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
