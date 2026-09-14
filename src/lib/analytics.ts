import "server-only";

/**
 * Provider-agnostic, privacy-conscious product analytics (Day 8 STEP 6).
 *
 * No analytics provider (PostHog, GA, etc.) is configured in this
 * environment. `trackEvent()` no-ops safely (a dev-only console line) until
 * one is wired in — every call site across the app stays unchanged when
 * that happens, since only this function's body changes.
 *
 * Server-only by design: every call site in this app is a server action or
 * route handler, which keeps event composition next to the real state
 * change (a goal actually inserted, a subscription actually activated)
 * rather than trusting a client-fired event that may never arrive.
 *
 * STABLE EVENT NAMES — add to this union, don't invent ad-hoc strings, so a
 * future real provider integration has one place to see every event this
 * app ever sends.
 */
export type AnalyticsEvent =
  | "signup_completed"
  | "onboarding_completed"
  | "first_account_created"
  | "first_transaction_created"
  | "first_budget_created"
  | "first_goal_created"
  | "first_ai_message_sent"
  | "first_income_opportunity_viewed"
  | "mission_completed"
  | "pricing_viewed"
  | "checkout_started"
  | "subscription_activated"
  | "subscription_canceled"
  | "monthly_review_completed";

/**
 * Event metadata is deliberately shaped as small, non-identifying tags —
 * never raw financial values, free text, or anything from an AI
 * conversation. See file header for the full "never send" list; the type
 * system only allows primitives here, but the discipline of *which*
 * primitives matters just as much (e.g. `plan`, not `priceThbPerMonth`).
 */
export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

/**
 * Fire-and-forget: never throws, never blocks the caller's real work on a
 * failed analytics call. Wire a real provider here (e.g.
 * `posthog.capture(userId, event, properties)`) when one is configured.
 */
export function trackEvent(event: AnalyticsEvent, userId: string, properties?: AnalyticsProperties): void {
  try {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[analytics] ${event}`, { userId, ...properties });
    }
    // No provider configured — see file header. When one is added:
    //   if (process.env.ANALYTICS_WRITE_KEY) provider.capture(userId, event, properties);
  } catch {
    // Analytics must never be able to break the caller's real operation.
  }
}
