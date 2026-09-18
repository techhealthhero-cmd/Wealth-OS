import { z } from "zod";

import { captureMessage } from "@/lib/observability";

export type AppEnv = "production" | "staging" | "development";

/**
 * Reads the explicit environment signal set by `next.config.ts` (which
 * itself falls back to Vercel's `VERCEL_ENV` at build time when
 * `NEXT_PUBLIC_APP_ENV` isn't set explicitly). Safe to call from client
 * code — this is the one function the staging badge and every safety check
 * below reads to answer "is this staging?".
 */
export function getAppEnv(): AppEnv {
  const value = process.env.NEXT_PUBLIC_APP_ENV;
  if (value === "production" || value === "staging" || value === "development") return value;
  return "production"; // Fail toward the stricter, more-validated path if this is ever somehow unset.
}

/**
 * Client-safe environment variables. These are inlined into the browser
 * bundle by Next.js at build time, so they must never contain secrets.
 *
 * `NEXT_PUBLIC_STAGING_SUPABASE_URL`/`_ANON_KEY` are optional — a genuinely
 * separate Supabase project for staging/Preview deployments, so a Preview
 * build never reads or writes the production database. See
 * `resolveSupabaseConfig()` below for exactly when they're used instead of
 * the primary `NEXT_PUBLIC_SUPABASE_*` pair.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, {
    message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required",
  }),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_STAGING_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

/**
 * Server-only environment variables, layered on top of the client schema.
 * `getServerEnv` must only be called from server-side code — the Supabase
 * admin client (lib/supabase/admin.ts) additionally guards this with the
 * `server-only` package so an accidental client import fails at build time.
 */
const serverEnvSchema = clientEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  STAGING_SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  // Day 7 billing (Stripe). All optional — getBillingProvider() returns null
  // when unset, the same "not configured is a real, expected state" pattern
  // as AI_API_KEY/getAIProvider(). Never read client-side. The SAME
  // variable names are used for both Production and Preview — Vercel scopes
  // their VALUES per environment (Live keys for Production, Test/Sandbox
  // keys for Preview); the safety net is `assertProductionConsistency()`
  // below refusing to run at all if a staging/Preview build is ever handed
  // a live-mode (`sk_live_`) secret key.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_PLUS: z.string().optional(),
  STRIPE_PRICE_ID_PRO: z.string().optional(),
});

function formatIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

/**
 * Staging isolation (post-launch audit): a Preview deployment must never
 * read or write the production Supabase project. Rather than infer this
 * from a hardcoded production project ref (which this codebase's own rules
 * forbid embedding), staging gets its OWN, differently-NAMED env vars —
 * `NEXT_PUBLIC_STAGING_SUPABASE_URL`/`_ANON_KEY`/
 * `STAGING_SUPABASE_SERVICE_ROLE_KEY`. There is no name collision possible:
 * if they're unset, this transparently falls back to the primary
 * `NEXT_PUBLIC_SUPABASE_*` pair (today's behavior, so nothing breaks before
 * a staging project exists) — callers never need to know which project is
 * actually active, they just keep reading `NEXT_PUBLIC_SUPABASE_URL`/
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` off the returned object exactly as before.
 */
export function resolveSupabaseConfig(vars: {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_STAGING_SUPABASE_URL?: string;
  NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY?: string;
}): { url: string; anonKey: string; isStaging: boolean } {
  if (getAppEnv() === "staging" && vars.NEXT_PUBLIC_STAGING_SUPABASE_URL && vars.NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY) {
    return { url: vars.NEXT_PUBLIC_STAGING_SUPABASE_URL, anonKey: vars.NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY, isStaging: true };
  }
  return { url: vars.NEXT_PUBLIC_SUPABASE_URL, anonKey: vars.NEXT_PUBLIC_SUPABASE_ANON_KEY, isStaging: false };
}

/** Same swap for the service-role key — kept in lockstep with `resolveSupabaseConfig()` so the admin client and the regular client can never point at two different projects. */
export function resolveServiceRoleKey(vars: { SUPABASE_SERVICE_ROLE_KEY?: string; STAGING_SUPABASE_SERVICE_ROLE_KEY?: string }): string | undefined {
  if (getAppEnv() === "staging" && vars.STAGING_SUPABASE_SERVICE_ROLE_KEY) {
    return vars.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  }
  return vars.SUPABASE_SERVICE_ROLE_KEY;
}

let cachedClientEnv: (z.infer<typeof clientEnvSchema> & { isUsingStagingSupabase: boolean }) | undefined;

/**
 * Validated client-safe env vars. Safe to import from client components.
 * `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` on the returned
 * object are the ACTIVE project for this environment — already resolved
 * per `resolveSupabaseConfig()` above, so every existing call site
 * (`lib/supabase/client.ts`, `server.ts`, `middleware.ts`) needed zero
 * changes to automatically respect staging isolation once configured.
 */
export function getClientEnv() {
  if (cachedClientEnv) return cachedClientEnv;

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STAGING_SUPABASE_URL: process.env.NEXT_PUBLIC_STAGING_SUPABASE_URL,
    NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid or missing client environment variables:\n${formatIssues(
        parsed.error
      )}\n\nCopy .env.example to .env.local and fill in the required values.`
    );
  }

  const resolved = resolveSupabaseConfig(parsed.data);
  cachedClientEnv = {
    ...parsed.data,
    NEXT_PUBLIC_SUPABASE_URL: resolved.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolved.anonKey,
    isUsingStagingSupabase: resolved.isStaging,
  };
  return cachedClientEnv;
}

let cachedServerEnv:
  | (z.infer<typeof serverEnvSchema> & { isUsingStagingSupabase: boolean })
  | undefined;

/**
 * Validated full env (client + server-only vars). Only import this from
 * server-side code (Server Components, Route Handlers, Server Actions).
 */
export function getServerEnv() {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STAGING_SUPABASE_URL: process.env.NEXT_PUBLIC_STAGING_SUPABASE_URL,
    NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    STAGING_SUPABASE_SERVICE_ROLE_KEY: process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ID_PLUS: process.env.STRIPE_PRICE_ID_PLUS,
    STRIPE_PRICE_ID_PRO: process.env.STRIPE_PRICE_ID_PRO,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid or missing server environment variables:\n${formatIssues(
        parsed.error
      )}\n\nCopy .env.example to .env.local and fill in the required values.`
    );
  }

  // Vercel Preview deployments build and run with NODE_ENV=production too
  // (only VERCEL_ENV distinguishes them) — so this check already covers
  // staging, not just production, which is exactly what the Stripe
  // live-key safeguard below needs.
  if (process.env.NODE_ENV === "production") {
    assertProductionConsistency(parsed.data);
  }

  const resolved = resolveSupabaseConfig(parsed.data);
  cachedServerEnv = {
    ...parsed.data,
    NEXT_PUBLIC_SUPABASE_URL: resolved.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolved.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: resolveServiceRoleKey(parsed.data),
    isUsingStagingSupabase: resolved.isStaging,
  };
  return cachedServerEnv;
}

/** Pure, testable prefix check — Stripe's own key format, not an inference. */
export function isLiveStripeKey(key: string | undefined): boolean {
  return Boolean(key?.startsWith("sk_live_"));
}

export function isTestStripeKey(key: string | undefined): boolean {
  return Boolean(key?.startsWith("sk_test_"));
}

/**
 * Day 8 STEP 2, extended by the staging-isolation audit: catches
 * half-configured production integrations AND the single most dangerous
 * staging misconfiguration this app can have — a Preview/staging
 * deployment holding a Stripe LIVE secret key, which would let a "test"
 * checkout on staging place a real charge. Never logs or includes any
 * secret's actual value — only which names are present / which mode a key
 * looks like.
 */
export function assertProductionConsistency(env: z.infer<typeof serverEnvSchema>): void {
  const stripeVars = {
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ID_PLUS: env.STRIPE_PRICE_ID_PLUS,
    STRIPE_PRICE_ID_PRO: env.STRIPE_PRICE_ID_PRO,
  };
  const stripeConfigured = Object.values(stripeVars).filter(Boolean).length;
  if (stripeConfigured > 0 && stripeConfigured < 4) {
    const missing = Object.entries(stripeVars)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    throw new Error(
      `Billing is partially configured: missing ${missing.join(", ")}. ` +
        "Either set all four STRIPE_* variables or none of them — a partial " +
        "configuration lets checkout appear to work while the webhook can never " +
        "verify (or vice versa), silently leaving paid users on the Free plan."
    );
  }

  // Billing writes (checkout customer bootstrap, webhook state changes) go
  // through the service-role admin client — see src/lib/supabase/admin.ts —
  // which RLS deliberately gives the authenticated role no path around.
  if (stripeConfigured === 4 && !env.SUPABASE_SERVICE_ROLE_KEY && !env.STAGING_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "STRIPE_* is configured but neither SUPABASE_SERVICE_ROLE_KEY nor " +
        "STAGING_SUPABASE_SERVICE_ROLE_KEY is set. Billing writes require the " +
        "service-role client and will throw at request time without one."
    );
  }

  const appEnv = getAppEnv();

  // The critical staging-safety check: a non-production deployment must
  // never hold a live-mode secret key. Hard-fails the whole deployment
  // (this function is called from getServerEnv(), which nearly every
  // request path calls) rather than letting a single misrouted webhook
  // silently place a real charge.
  if (appEnv !== "production" && isLiveStripeKey(env.STRIPE_SECRET_KEY)) {
    throw new Error(
      `STRIPE_SECRET_KEY looks like a LIVE-mode key (sk_live_...) but NEXT_PUBLIC_APP_ENV is "${appEnv}", not "production". ` +
        "Refusing to start: a staging/preview deployment must only ever use a Stripe TEST-mode (sk_test_...) key. " +
        "Fix this in Vercel's Preview environment variables before redeploying."
    );
  }

  // The reverse case is a functional bug, not a safety hazard (no real
  // charge can happen on test keys) — worth a loud warning, not a hard
  // stop that would take production down over a key-naming mixup.
  if (appEnv === "production" && isTestStripeKey(env.STRIPE_SECRET_KEY)) {
    captureMessage(
      "NEXT_PUBLIC_APP_ENV is \"production\" but STRIPE_SECRET_KEY looks like a TEST-mode key (sk_test_...) — real users will not be able to complete real payments until this is corrected.",
      { route: "config/env", operation: "assertProductionConsistency" }
    );
  }
}

/**
 * Throws a clear error if the service role key isn't configured. Call this
 * before constructing an admin client so failures are obvious, not a cryptic
 * Supabase auth error deep in a request handler.
 */
export function requireServiceRoleKey() {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required for admin/service-role " +
        "operations and must never be exposed to the browser."
    );
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}
