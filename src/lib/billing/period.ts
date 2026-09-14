/**
 * AI usage is metered by calendar-month billing period for every plan
 * (Free/Plus/Pro alike) — deliberately NOT tied to a paid subscription's
 * actual `current_period_start`/`current_period_end`, since a Free user has
 * neither. A single, simple, always-defined period keeps the limiter
 * correct and testable for every plan without a conditional on whether a
 * real Stripe period exists. Pure/deterministic — no DB, no auth — same
 * testing rationale as `src/lib/financial/*.ts`.
 */

export interface BillingPeriod {
  start: Date;
  /** Exclusive upper bound — the first instant of the next month. */
  end: Date;
}

export function getCurrentBillingPeriod(now: Date = new Date()): BillingPeriod {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

/** The date usage resets — the 1st of next month — as a "YYYY-MM-DD" local calendar string for display. */
export function getNextResetDateString(now: Date = new Date()): string {
  const { end } = getCurrentBillingPeriod(now);
  const year = end.getFullYear();
  const month = String(end.getMonth() + 1).padStart(2, "0");
  const day = String(end.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
