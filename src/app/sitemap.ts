import type { MetadataRoute } from "next";

import { getClientEnv } from "@/config/env";

/** Day 8 STEP 11 — only the genuinely public, indexable pages. Everything under (app) is noindexed (see robots.ts) and deliberately excluded here too. */
export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getClientEnv().NEXT_PUBLIC_APP_URL;
  const now = new Date();

  return [
    { url: appUrl, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${appUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
}
