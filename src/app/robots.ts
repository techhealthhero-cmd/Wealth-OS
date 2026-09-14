import type { MetadataRoute } from "next";

import { getClientEnv } from "@/config/env";

/**
 * Day 8 STEP 11. Belt-and-suspenders alongside the per-route `robots`
 * metadata (`(app)/layout.tsx` noindexes every authenticated page) — this
 * file additionally tells crawlers not to bother requesting those paths at
 * all. `/api/*` is disallowed outright: none of it is a page, and the
 * billing webhook in particular should never receive stray crawler traffic.
 */
export default function robots(): MetadataRoute.Robots {
  const appUrl = getClientEnv().NEXT_PUBLIC_APP_URL;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/money", "/plan", "/earn", "/ai", "/profile", "/billing", "/pricing", "/missions", "/review", "/notifications", "/onboarding", "/api/"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
