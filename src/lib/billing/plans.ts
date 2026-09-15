/**
 * Centralized plan / entitlement configuration — the single source of truth
 * for what Free, Plus, and Pro include. CLAUDE.md Day 7 explicitly forbids
 * scattering `if (plan === "pro")` checks throughout the app; every gate in
 * this codebase reads from `PLANS` (directly or via
 * `src/lib/billing/entitlements.ts`), never a hardcoded plan comparison.
 *
 * This is deliberately a pure, deterministic config module — same
 * architectural role as `src/lib/financial/*.ts` (e.g. priority-engine.ts):
 * no DB access, no auth, fully unit-testable, importable from client and
 * server code alike (it contains no secrets — provider price IDs live in
 * server-only env vars and are looked up separately, see
 * `getStripePriceId()` below).
 */

export type PlanId = "free" | "plus" | "pro";

export const PLAN_IDS: PlanId[] = ["free", "plus", "pro"];

/**
 * Stable feature-ID constants (Day 7 STEP 5). Every server-side gate and
 * every paywall UI element refers to one of these — never a raw string
 * plan comparison.
 */
export const FEATURES = {
  AI_CHAT: "AI_CHAT",
  FORECAST: "FORECAST",
  DEBT_PLANNER: "DEBT_PLANNER",
  ADVANCED_GOALS: "ADVANCED_GOALS",
  SUBSCRIPTION_DETECTOR: "SUBSCRIPTION_DETECTOR",
  MONTHLY_REVIEW: "MONTHLY_REVIEW",
  INCOME_OPPORTUNITIES: "INCOME_OPPORTUNITIES",
  INCOME_MISSIONS: "INCOME_MISSIONS",
  WEALTH_MISSIONS: "WEALTH_MISSIONS",
  ADVANCED_INSIGHTS: "ADVANCED_INSIGHTS",
} as const;

export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES];

/** Numeric/nullable limits a plan can impose. `null` means unlimited. */
export interface PlanLimits {
  /** AI Money Coach messages allowed per calendar-month billing period. */
  aiMessagesPerMonth: number;
  /** Active (non-archived) financial goals. */
  activeGoalsMax: number | null;
  /** Rows shown from the Income Opportunity catalog (Day 5 Earn). */
  incomeOpportunitiesMax: number | null;
  /** Concurrently visible Income Missions (Day 5). */
  incomeMissionsMax: number | null;
}

export interface PlanDefinition {
  id: PlanId;
  /** Thai + English display names — plan names are proper nouns, not translated. */
  displayName: string;
  /** Display-only metadata. THB, monthly billing only (no annual plan exists — never claim an annual discount). */
  priceThbPerMonth: number;
  billingPeriod: "monthly";
  limits: PlanLimits;
  features: Record<FeatureId, boolean>;
}

/**
 * STEP 2 packaging. Free stays genuinely useful (full Accounts/Transactions/
 * Budget/Net Worth/Wealth Score/Dashboard/Safe-to-Spend from Days 1-3, basic
 * Income Engine and basic Wealth Missions from Days 5-6 — none of those are
 * gated below) rather than being cut down to a stub. Plus unlocks the deeper
 * planning tools (Forecast, Debt Planner, full Monthly Review, Subscription
 * Detector) and removes the small Free ceilings. Pro currently differs from
 * Plus by higher numeric limits (AI allowance, no goal/opportunity/mission
 * ceiling difference — Plus is already unlimited there) rather than
 * additional feature flags, since Day 7 doesn't introduce new advanced
 * forecasting/scenario tooling beyond what Day 3's Forecast already builds;
 * see PROJECT_STATUS.md "Known Limitations" for this documented as a
 * deliberate scope decision, not an oversight.
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    displayName: "Free",
    priceThbPerMonth: 0,
    billingPeriod: "monthly",
    limits: {
      aiMessagesPerMonth: 15,
      activeGoalsMax: 3,
      incomeOpportunitiesMax: 3,
      incomeMissionsMax: 3,
    },
    features: {
      AI_CHAT: true,
      FORECAST: false,
      DEBT_PLANNER: false,
      ADVANCED_GOALS: false,
      SUBSCRIPTION_DETECTOR: false,
      MONTHLY_REVIEW: false,
      INCOME_OPPORTUNITIES: true,
      INCOME_MISSIONS: true,
      WEALTH_MISSIONS: true,
      ADVANCED_INSIGHTS: false,
    },
  },
  plus: {
    id: "plus",
    displayName: "Plus",
    priceThbPerMonth: 149,
    billingPeriod: "monthly",
    limits: {
      aiMessagesPerMonth: 150,
      activeGoalsMax: null,
      incomeOpportunitiesMax: null,
      incomeMissionsMax: null,
    },
    features: {
      AI_CHAT: true,
      FORECAST: true,
      DEBT_PLANNER: true,
      ADVANCED_GOALS: true,
      SUBSCRIPTION_DETECTOR: true,
      MONTHLY_REVIEW: true,
      INCOME_OPPORTUNITIES: true,
      INCOME_MISSIONS: true,
      WEALTH_MISSIONS: true,
      ADVANCED_INSIGHTS: true,
    },
  },
  pro: {
    id: "pro",
    displayName: "Pro",
    priceThbPerMonth: 399,
    billingPeriod: "monthly",
    limits: {
      aiMessagesPerMonth: 500,
      activeGoalsMax: null,
      incomeOpportunitiesMax: null,
      incomeMissionsMax: null,
    },
    features: {
      AI_CHAT: true,
      FORECAST: true,
      DEBT_PLANNER: true,
      ADVANCED_GOALS: true,
      SUBSCRIPTION_DETECTOR: true,
      MONTHLY_REVIEW: true,
      INCOME_OPPORTUNITIES: true,
      INCOME_MISSIONS: true,
      WEALTH_MISSIONS: true,
      ADVANCED_INSIGHTS: true,
    },
  },
};

export function getPlanDefinition(planId: PlanId): PlanDefinition {
  return PLANS[planId];
}

export function planHasFeature(planId: PlanId, feature: FeatureId): boolean {
  return PLANS[planId].features[feature];
}

export function getPlanLimit(planId: PlanId, limit: keyof PlanLimits): number | null {
  return PLANS[planId].limits[limit];
}

/**
 * Subscription lifecycle statuses this app models (Day 7 STEP 3).
 * `unpaid` added post-launch billing audit: sent by Stripe when its
 * automatic retry schedule for a past-due invoice is exhausted without the
 * subscription being canceled outright. Previously fell through to
 * `incomplete` in `normalizeSubscription()`'s fallback — safe (both are
 * already non-entitling) but an inaccurate status label. Modeled as its own
 * status now for accurate display; entitlement behavior is unchanged.
 */
export type SubscriptionStatus = "free" | "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";

/**
 * Which statuses actually grant the subscription's paid plan. `past_due`
 * still counts as entitled for a grace period (standard SaaS practice —
 * Stripe itself keeps the subscription active through its retry schedule
 * before marking it `canceled` or `unpaid`); `incomplete`, `unpaid`, and
 * `canceled` do not, and a "free" row is free by definition. Never grants
 * access on any status not explicitly listed here.
 */
const ENTITLING_STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due"];

export function statusGrantsEntitlement(status: SubscriptionStatus): boolean {
  return ENTITLING_STATUSES.includes(status);
}

// Stripe price-ID lookups deliberately do NOT live in this file: this module
// is imported from client components (pricing page, paywall badges) for
// plan display metadata, and it must never touch `process.env.STRIPE_*`
// (unprefixed server secrets are not inlined into the browser bundle, so a
// client-side call would silently read `undefined`, or worse, throw if
// `process` isn't polyfilled). See `getStripePriceId()` /
// `planIdForStripePriceId()` in `src/lib/billing/provider.ts`, a
// `server-only` module, instead.
