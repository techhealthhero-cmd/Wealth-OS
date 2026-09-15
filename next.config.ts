import type { NextConfig } from "next";

/**
 * Staging/production environment detection. `NEXT_PUBLIC_APP_ENV` is the
 * explicit, authoritative signal `src/config/env.ts` reads everywhere else
 * in the app (it must be `NEXT_PUBLIC_*` to reach client components — the
 * staging badge in particular). Vercel's own `VERCEL_ENV` ("production" |
 * "preview" | "development") is NOT inlined into the client bundle on its
 * own, so this config computes the fallback once at build time and injects
 * it as `NEXT_PUBLIC_APP_ENV` — giving every Preview deployment a correct
 * default with zero manual Vercel configuration, while an explicit
 * `NEXT_PUBLIC_APP_ENV` set in Vercel's project settings (or `.env.local`)
 * still always wins.
 */
function resolveDefaultAppEnv(): "production" | "staging" | "development" {
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "staging";
  return "development";
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV ?? resolveDefaultAppEnv(),
  },
};

export default nextConfig;
