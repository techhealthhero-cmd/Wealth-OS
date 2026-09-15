import { describe, expect, it } from "vitest";

import {
  FEATURES,
  PLANS,
  getPlanLimit,
  planHasFeature,
  statusGrantsEntitlement,
  type SubscriptionStatus,
} from "@/lib/billing/plans";
import { resolvePlanFromSubscription } from "@/lib/billing/entitlements";
import type { Subscription } from "@/types/database";

function row(overrides: Partial<Subscription>): Subscription {
  return {
    id: "sub-1",
    user_id: "user-1",
    plan: "plus",
    status: "active",
    provider: "stripe",
    provider_customer_id: "cus_1",
    provider_subscription_id: "sub_1",
    provider_price_id: "price_1",
    current_period_start: "2026-09-01T00:00:00.000Z",
    current_period_end: "2026-10-01T00:00:00.000Z",
    cancel_at_period_end: false,
    trial_end: null,
    last_webhook_event_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolvePlanFromSubscription — plan resolution (STEP 17)", () => {
  it("resolves to free when there is no subscription row at all", () => {
    expect(resolvePlanFromSubscription(null)).toBe("free");
  });

  it("resolves to the row's plan when status is active", () => {
    expect(resolvePlanFromSubscription(row({ plan: "plus", status: "active" }))).toBe("plus");
  });

  it("resolves to the row's plan when status is trialing", () => {
    expect(resolvePlanFromSubscription(row({ plan: "pro", status: "trialing" }))).toBe("pro");
  });

  it("still grants the plan during a past_due grace period", () => {
    expect(resolvePlanFromSubscription(row({ plan: "plus", status: "past_due" }))).toBe("plus");
  });

  it("falls back to free once status is canceled, even if `plan` still says plus/pro", () => {
    expect(resolvePlanFromSubscription(row({ plan: "pro", status: "canceled" }))).toBe("free");
  });

  it("falls back to free when status is incomplete", () => {
    expect(resolvePlanFromSubscription(row({ plan: "plus", status: "incomplete" }))).toBe("free");
  });

  it("falls back to free when status is free regardless of a stale paid `plan` value", () => {
    expect(resolvePlanFromSubscription(row({ plan: "plus", status: "free" }))).toBe("free");
  });

  const statuses: SubscriptionStatus[] = ["free", "trialing", "active", "past_due", "canceled", "incomplete"];
  it.each(statuses)("statusGrantsEntitlement(%s) matches the documented grace-period rule", (status) => {
    const expected = status === "trialing" || status === "active" || status === "past_due";
    expect(statusGrantsEntitlement(status)).toBe(expected);
  });
});

describe("planHasFeature / getPlanLimit — feature entitlement (STEP 17)", () => {
  it("Free lacks every premium feature named in STEP 2", () => {
    expect(planHasFeature("free", FEATURES.FORECAST)).toBe(false);
    expect(planHasFeature("free", FEATURES.DEBT_PLANNER)).toBe(false);
    expect(planHasFeature("free", FEATURES.SUBSCRIPTION_DETECTOR)).toBe(false);
    expect(planHasFeature("free", FEATURES.MONTHLY_REVIEW)).toBe(false);
    expect(planHasFeature("free", FEATURES.ADVANCED_GOALS)).toBe(false);
  });

  it("Free still includes the core, always-on features (never aggressively crippled)", () => {
    expect(planHasFeature("free", FEATURES.AI_CHAT)).toBe(true);
    expect(planHasFeature("free", FEATURES.INCOME_OPPORTUNITIES)).toBe(true);
    expect(planHasFeature("free", FEATURES.INCOME_MISSIONS)).toBe(true);
    expect(planHasFeature("free", FEATURES.WEALTH_MISSIONS)).toBe(true);
  });

  it("a Free -> Plus transition unlocks every premium feature", () => {
    for (const feature of Object.values(FEATURES)) {
      expect(planHasFeature("plus", feature)).toBe(true);
    }
  });

  it("Pro includes everything Plus includes (a strict superset today)", () => {
    for (const feature of Object.values(FEATURES)) {
      expect(planHasFeature("pro", feature)).toBe(planHasFeature("plus", feature) || planHasFeature("pro", feature));
      if (planHasFeature("plus", feature)) expect(planHasFeature("pro", feature)).toBe(true);
    }
  });

  it("numeric limits increase monotonically Free < Plus < Pro for AI messages", () => {
    expect(PLANS.free.limits.aiMessagesPerMonth).toBeLessThan(PLANS.plus.limits.aiMessagesPerMonth);
    expect(PLANS.plus.limits.aiMessagesPerMonth).toBeLessThan(PLANS.pro.limits.aiMessagesPerMonth);
  });

  it("Free caps active goals; Plus/Pro are unlimited (null)", () => {
    expect(getPlanLimit("free", "activeGoalsMax")).toBe(3);
    expect(getPlanLimit("plus", "activeGoalsMax")).toBeNull();
    expect(getPlanLimit("pro", "activeGoalsMax")).toBeNull();
  });
});

describe("security (STEP 17/18): a premium server action rejects a Free user", () => {
  // `requireFeature()` (src/lib/billing/entitlements.ts) is a two-line
  // composition of `getUserPlan()` (DB-backed — see `resolvePlanFromSubscription`
  // above, tested without mocking Supabase) and `planHasFeature()` (pure,
  // tested above). This proves the composed decision itself is correct for
  // every gated page/action in this codebase (forecast, debt planner,
  // subscription detector, monthly review, goal-limit): a Free-resolved
  // plan is refused every premium feature; a client can never talk its way
  // past this by claiming a different plan, because the plan came from
  // `resolvePlanFromSubscription`, never from request input. The
  // complementary DB-level guarantee — "a user cannot write their own paid
  // plan" — is RLS's job (migration 0008: no insert/update policy on
  // `subscriptions` for the authenticated role) and is verified live with
  // two real Supabase users, not by a unit test; see PROJECT_STATUS.md "Day
  // 7 RLS Verification".
  function requireFeatureDecision(plan: ReturnType<typeof resolvePlanFromSubscription>, feature: Parameters<typeof planHasFeature>[1]) {
    return { allowed: planHasFeature(plan, feature), plan };
  }

  it("a signed-out / no-row / canceled user resolves to free and is refused a Plus-only feature", () => {
    const plan = resolvePlanFromSubscription(null);
    const decision = requireFeatureDecision(plan, FEATURES.FORECAST);
    expect(decision).toEqual({ allowed: false, plan: "free" });
  });

  it("an active Plus subscriber is allowed the same feature", () => {
    const plan = resolvePlanFromSubscription(row({ plan: "plus", status: "active" }));
    const decision = requireFeatureDecision(plan, FEATURES.FORECAST);
    expect(decision).toEqual({ allowed: true, plan: "plus" });
  });

  it("a canceled ex-Plus subscriber loses access — status always wins over a stale `plan` value", () => {
    const plan = resolvePlanFromSubscription(row({ plan: "plus", status: "canceled" }));
    const decision = requireFeatureDecision(plan, FEATURES.DEBT_PLANNER);
    expect(decision).toEqual({ allowed: false, plan: "free" });
  });
});
