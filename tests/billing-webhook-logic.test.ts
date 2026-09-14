import { afterEach, describe, expect, it } from "vitest";

import {
  isDuplicateEventError,
  buildSubscriptionUpsertPatch,
  buildSubscriptionCancelPatch,
  buildPastDuePatch,
  buildRecoveredPatch,
} from "@/lib/billing/webhook-logic";
import type { NormalizedSubscription } from "@/lib/billing/provider";

const ORIGINAL_ENV = { ...process.env };

function normalized(overrides: Partial<NormalizedSubscription> = {}): NormalizedSubscription {
  return {
    customerId: "cus_1",
    subscriptionId: "sub_1",
    priceId: "price_plus_123",
    status: "active",
    currentPeriodStart: "2026-09-01T00:00:00.000Z",
    currentPeriodEnd: "2026-10-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    trialEnd: null,
    ...overrides,
  };
}

describe("isDuplicateEventError — webhook idempotency (STEP 15/17)", () => {
  it("recognizes a Postgres unique_violation as a duplicate delivery", () => {
    expect(isDuplicateEventError({ code: "23505" })).toBe(true);
  });

  it("does not treat other error codes as a duplicate", () => {
    expect(isDuplicateEventError({ code: "42501" })).toBe(false);
  });

  it("does not treat a null/undefined error as a duplicate", () => {
    expect(isDuplicateEventError(null)).toBe(false);
    expect(isDuplicateEventError(undefined)).toBe(false);
  });
});

describe("buildSubscriptionUpsertPatch — subscription.created/.updated (STEP 17)", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("resolves the plan from the price id and copies every normalized field", () => {
    process.env.STRIPE_PRICE_ID_PLUS = "price_plus_123";
    const patch = buildSubscriptionUpsertPatch(normalized());
    expect(patch).toEqual({
      provider: "stripe",
      provider_customer_id: "cus_1",
      provider_subscription_id: "sub_1",
      provider_price_id: "price_plus_123",
      plan: "plus",
      status: "active",
      current_period_start: "2026-09-01T00:00:00.000Z",
      current_period_end: "2026-10-01T00:00:00.000Z",
      cancel_at_period_end: false,
      trial_end: null,
    });
  });

  it("returns null for an unrecognized price id — never activates a plan on unverified data (STEP 16)", () => {
    process.env.STRIPE_PRICE_ID_PLUS = "price_plus_123";
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_456";
    expect(buildSubscriptionUpsertPatch(normalized({ priceId: "price_unknown" }))).toBeNull();
  });

  it("reflects a past_due status straight through (grace period, not yet canceled)", () => {
    process.env.STRIPE_PRICE_ID_PLUS = "price_plus_123";
    const patch = buildSubscriptionUpsertPatch(normalized({ status: "past_due" }));
    expect(patch?.status).toBe("past_due");
  });
});

describe("buildSubscriptionCancelPatch / buildPastDuePatch / buildRecoveredPatch — subscription.deleted, payment failed/succeeded (STEP 17)", () => {
  it("cancellation sets status=canceled and clears cancel_at_period_end", () => {
    expect(buildSubscriptionCancelPatch()).toEqual({ status: "canceled", cancel_at_period_end: false });
  });

  it("a failed payment sets status=past_due", () => {
    expect(buildPastDuePatch()).toEqual({ status: "past_due" });
  });

  it("a recovered payment sets status=active", () => {
    expect(buildRecoveredPatch()).toEqual({ status: "active" });
  });
});
