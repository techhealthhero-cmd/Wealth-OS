/**
 * Provider-agnostic error/event observability boundary (Day 8 STEP 5).
 *
 * No error-tracking provider (Sentry, etc.) is configured in this
 * environment — no `SENTRY_DSN` or equivalent exists anywhere in
 * `src/config/env.ts` or `.env.local`. Rather than pretend one is wired up,
 * this module gives every call site (route handlers, server actions,
 * `error.tsx`) one stable function to call now; wiring a real provider
 * later means changing the body of `captureError()` alone, not every call
 * site across the app.
 *
 * Safe to import from both client and server code — `captureError()` never
 * receives anything server-only.
 *
 * NEVER pass to `context`:
 * - API keys, tokens, passwords, or any secret
 * - full financial context (raw balances/transactions) — a hash/count is fine
 * - full AI prompt/response text — a length or a boolean is fine
 * - full card/payment data (this app never touches card data directly —
 *   Stripe Checkout/Portal handle it entirely off our servers)
 */

export interface ErrorContext {
  /** e.g. "api/ai/chat", "billing.webhook", "server-action:createGoal" */
  route: string;
  /** e.g. "anthropic", "stripe", "supabase" — omit for app-internal errors */
  provider?: string;
  /** e.g. "checkout_session_create", "chat_stream", "db_query" */
  operation?: string;
  /** The signed-in user's id is fine to log (it's already how RLS scopes data) — never their email/name here. */
  userId?: string;
  /** Any additional non-sensitive tag. */
  extra?: Record<string, string | number | boolean | null>;
}

/**
 * Reports a caught error. Always logs a structured line server-side (visible
 * in Vercel/host logs); in a browser context, `console.error`'s output goes
 * to the browser devtools console only — no network call is made unless a
 * real provider is wired in below.
 */
export function captureError(error: unknown, context: ErrorContext): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(`[observability] ${context.route}`, {
    message,
    ...(process.env.NODE_ENV !== "production" ? { stack } : {}),
    provider: context.provider,
    operation: context.operation,
    userId: context.userId,
    ...context.extra,
  });

  // Wire a real provider here when one is configured, e.g.:
  //   if (process.env.SENTRY_DSN) Sentry.captureException(error, { tags: context });
  // Left unimplemented deliberately — see file header.
}

/** Lighter-weight than captureError: a notable event that isn't an error (e.g. "billing webhook: unrecognized price id"). */
export function captureMessage(message: string, context: ErrorContext): void {
  console.warn(`[observability] ${context.route}`, {
    message,
    provider: context.provider,
    operation: context.operation,
    userId: context.userId,
    ...context.extra,
  });
}
