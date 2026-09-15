import { afterEach, describe, expect, it } from "vitest";

import {
  isDuplicateEventError,
  isStaleWebhookEvent,
  buildSubscriptionUpsertPatch,
  buildSubscriptionCancelPatch,
  buildPastDuePatch,
  buildRecoveredPatch,
} from "@/lib/billing/webhook-logic";
import type { NormalizedSubscription } from "@/lib/billing/provider";

const ORIGINAL_ENV = { ...process.env };
const T1 = "2026-09-01T00:00:00.000Z";
const T2 = "2026-09-02T00:00:00.000Z";

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

describe("isStaleWebhookEvent — out-of-order webhook delivery (billing audit)", () => {
  it("a fresh row (no prior event recorded) never counts as stale", () => {
    expect(isStaleWebhookEvent(null, T1)).toBe(false);
  });

  it("an event newer than the last-applied one is not stale", () => {
    expect(isStaleWebhookEvent(T1, T2)).toBe(false);
  });

  it("an event older than the last-applied one IS stale — this is the actual bug this guards against: a delayed 'active' event must not resurrect a since-canceled row", () => {
    expect(isStaleWebhookEvent(T2, T1)).toBe(true);
  });

  it("an event with the exact same timestamp as the last-applied one is not stale (idempotent re-application is fine, distinct from the billing_events dedupe check which already blocks true duplicates)", () => {
    expect(isStaleWebhookEvent(T1, T1)).toBe(false);
  });
});

describe("buildSubscriptionUpsertPatch — subscription.created/.updated (STEP 17)", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("resolves the plan from the price id, copies every normalized field, and stamps the event timestamp", () => {
    process.env.STRIPE_PRICE_ID_PLUS = "price_plus_123";
    const patch = buildSubscriptionUpsertPatch(normalized(), T1);
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
      last_webhook_event_at: T1,
    });
  });

  it("returns null for an unrecognized price id — never activates a plan on unverified data (STEP 16)", () => {
    process.env.STRIPE_PRICE_ID_PLUS = "price_plus_123";
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_456";
    expect(buildSubscriptionUpsertPatch(normalized({ priceId: "price_unknown" }), T1)).toBeNull();
  });

  it("reflects a past_due status straight through (grace period, not yet canceled)", () => {
    process.env.STRIPE_PRICE_ID_PLUS = "price_plus_123";
    const patch = buildSubscriptionUpsertPatch(normalized({ status: "past_due" }), T1);
    expect(patch?.status).toBe("past_due");
  });

  it("reflects an unpaid status straight through (Stripe's retry schedule exhausted, still not canceled)", () => {
    process.env.STRIPE_PRICE_ID_PLUS = "price_plus_123";
    const patch = buildSubscriptionUpsertPatch(normalized({ status: "unpaid" }), T1);
    expect(patch?.status).toBe("unpaid");
  });
});

describe("buildSubscriptionCancelPatch / buildPastDuePatch / buildRecoveredPatch — subscription.deleted, payment failed/succeeded (STEP 17)", () => {
  it("cancellation sets status=canceled, clears cancel_at_period_end, and stamps the event timestamp", () => {
    expect(buildSubscriptionCancelPatch(T1)).toEqual({ status: "canceled", cancel_at_period_end: false, last_webhook_event_at: T1 });
  });

  it("a failed payment sets status=past_due and stamps the event timestamp", () => {
    expect(buildPastDuePatch(T1)).toEqual({ status: "past_due", last_webhook_event_at: T1 });
  });

  it("a recovered payment sets status=active and stamps the event timestamp", () => {
    expect(buildRecoveredPatch(T1)).toEqual({ status: "active", last_webhook_event_at: T1 });
  });
});
