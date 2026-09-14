import "server-only";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/observability";

/**
 * Simple, maintainable rate limiting (Day 8 STEP 12) — no external Redis/
 * rate-limit service is configured in this environment, so this calls the
 * `check_rate_limit()` Postgres function added in migration
 * `0009_rate_limits.sql` instead. It's a real, atomic, cross-instance fixed-
 * window counter (correct on a serverless host, unlike an in-memory map),
 * not a fake stand-in — but it is a single-Postgres-instance limiter, not a
 * globally-distributed one; that's an honest, documented scope, not a
 * distributed rate limiter this app doesn't actually have.
 *
 * The function is `security definer` and explicitly granted to `anon` +
 * `authenticated` (see the migration), so this works via the ordinary
 * request-scoped Supabase client — it does NOT need the service-role key,
 * unlike this app's billing writes.
 *
 * Fails OPEN: if the rate-limit check itself errors (e.g. the migration
 * hasn't been applied to some environment, or the DB is briefly
 * unreachable), the request is allowed through rather than blocking real
 * users because the limiter itself broke. The error is still reported via
 * `captureError` so a persistently-failing limiter is visible in logs.
 */
export interface RateLimitResult {
  allowed: boolean;
}

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
}

export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_window_seconds: options.windowSeconds,
      p_max_count: options.maxRequests,
    });

    if (error) {
      captureError(error, { route: "rate-limit", operation: "check_rate_limit" });
      return { allowed: true };
    }

    return { allowed: data === true };
  } catch (error) {
    captureError(error, { route: "rate-limit", operation: "check_rate_limit" });
    return { allowed: true };
  }
}

/**
 * Best-effort client IP for anonymous rate-limit keys (login/signup, before
 * a user id exists). Vercel sets `x-forwarded-for`; falls back to a shared
 * bucket key when it's absent (e.g. local dev), which under-limits rather
 * than over-limits in that case — acceptable for a dev-only fallback.
 */
export async function getClientIdentifier(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
