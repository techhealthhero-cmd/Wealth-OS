import { z } from "zod";

/**
 * Client-safe environment variables. These are inlined into the browser
 * bundle by Next.js at build time, so they must never contain secrets.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, {
    message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required",
  }),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

/**
 * Server-only environment variables, layered on top of the client schema.
 * `getServerEnv` must only be called from server-side code — the Supabase
 * admin client (lib/supabase/admin.ts) additionally guards this with the
 * `server-only` package so an accidental client import fails at build time.
 */
const serverEnvSchema = clientEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  // Day 7 billing (Stripe). All optional — getBillingProvider() returns null
  // when unset, the same "not configured is a real, expected state" pattern
  // as AI_API_KEY/getAIProvider(). Never read client-side.
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

let cachedClientEnv: z.infer<typeof clientEnvSchema> | undefined;

/**
 * Validated client-safe env vars. Safe to import from client components.
 */
export function getClientEnv() {
  if (cachedClientEnv) return cachedClientEnv;

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid or missing client environment variables:\n${formatIssues(
        parsed.error
      )}\n\nCopy .env.example to .env.local and fill in the required values.`
    );
  }

  cachedClientEnv = parsed.data;
  return cachedClientEnv;
}

let cachedServerEnv: z.infer<typeof serverEnvSchema> | undefined;

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
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
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

  if (process.env.NODE_ENV === "production") {
    assertProductionConsistency(parsed.data);
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/**
 * Day 8 STEP 2: catches half-configured production integrations that would
 * otherwise fail confusingly deep inside a request (e.g. checkout builds a
 * session against a price ID env var that was never set, or a webhook can
 * never verify because only the secret key was configured). Never logs or
 * includes any secret's actual value — only which names are present.
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
      `Billing is partially configured in production: missing ${missing.join(", ")}. ` +
        "Either set all four STRIPE_* variables or none of them — a partial " +
        "configuration lets checkout appear to work while the webhook can never " +
        "verify (or vice versa), silently leaving paid users on the Free plan."
    );
  }

  // Billing writes (checkout customer bootstrap, webhook state changes) go
  // through the service-role admin client — see src/lib/supabase/admin.ts —
  // which RLS deliberately gives the authenticated role no path around.
  if (stripeConfigured === 4 && !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "STRIPE_* is configured but SUPABASE_SERVICE_ROLE_KEY is not. Billing writes " +
        "require the service-role client and will throw at request time without it."
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
