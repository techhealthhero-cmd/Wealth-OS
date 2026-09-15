import crypto from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  StripeProvider,
  getBillingProvider,
  planIdForStripePriceId,
  __setBillingProviderForTesting,
  type BillingProvider,
} from "@/lib/billing/provider";

const ORIGINAL_ENV = { ...process.env };
const WEBHOOK_SECRET = "whsec_test_secret";

function signedHeader(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("getBillingProvider — fallback/error handling (mirrors getAIProvider)", () => {
  beforeEach(() => {
    __setBillingProviderForTesting(undefined);
  });

  afterEach(() => {
    __setBillingProviderForTesting(undefined);
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns null (never throws) when STRIPE_SECRET_KEY is not configured — the real state of this environment today", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(getBillingProvider()).toBeNull();
  });

  it("returns a provider once STRIPE_SECRET_KEY is set", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    const provider = getBillingProvider();
    expect(provider).not.toBeNull();
    expect(provider?.name).toBe("stripe");
  });

  it("returns null (defense-in-depth) when a live-mode key is present outside production — the exact incident this audit found: a Preview/staging deployment must never obtain a working live-mode provider, even if the startup-level env check somehow didn't run", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    process.env.STRIPE_SECRET_KEY = "sk_live_should_never_be_used_here";
    expect(getBillingProvider()).toBeNull();
  });

  it("returns a working provider for a live-mode key when NEXT_PUBLIC_APP_ENV is production (the correct, intended state)", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "sk_live_fake_shape_only";
    expect(getBillingProvider()).not.toBeNull();
  });

  it("still returns a working provider for a TEST-mode key while staging — this is the normal, safe staging configuration", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    process.env.STRIPE_SECRET_KEY = "sk_test_staging_fake";
    expect(getBillingProvider()).not.toBeNull();
  });

  it("lets tests inject a mock provider instead of hitting real Stripe (STEP 17: mock billing provider, never charge a real card)", async () => {
    const mockProvider: BillingProvider = {
      name: "mock",
      createCustomer: async () => ({ customerId: "cus_mock" }),
      createCheckoutSession: async () => ({ url: "https://example.test/checkout", sessionId: "cs_mock" }),
      createPortalSession: async () => ({ url: "https://example.test/portal" }),
      cancelSubscription: async () => {},
      resumeSubscription: async () => {},
      verifyWebhook: () => null,
      normalizeSubscription: () => {
        throw new Error("not used in this test");
      },
    };

    __setBillingProviderForTesting(mockProvider);
    expect(getBillingProvider()).toBe(mockProvider);

    const session = await getBillingProvider()?.createCheckoutSession({
      customerId: "cus_mock",
      userId: "user-1",
      priceId: "price_1",
      successUrl: "https://example.test/success",
      cancelUrl: "https://example.test/cancel",
    });
    expect(session?.url).toBe("https://example.test/checkout");
  });
});

describe("StripeProvider.verifyWebhook — signature verification (STEP 15/17)", () => {
  const EVENT_CREATED = 1_759_276_800;
  const payload = JSON.stringify({
    id: "evt_1",
    type: "customer.subscription.updated",
    created: EVENT_CREATED,
    data: { object: { id: "sub_1" } },
  });

  it("accepts a correctly signed payload and surfaces the event's own timestamp", () => {
    const provider = new StripeProvider("sk_test", WEBHOOK_SECRET);
    const event = provider.verifyWebhook(payload, signedHeader(payload, WEBHOOK_SECRET));
    expect(event).not.toBeNull();
    expect(event?.id).toBe("evt_1");
    expect(event?.type).toBe("customer.subscription.updated");
    expect(event?.createdAt).toBe(new Date(EVENT_CREATED * 1000).toISOString());
  });

  it("rejects a payload missing the 'created' field (malformed event envelope)", () => {
    const provider = new StripeProvider("sk_test", WEBHOOK_SECRET);
    const malformed = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } });
    // created is undefined -> new Date(NaN).toISOString() throws, verifyWebhook's try/catch turns that into null.
    expect(provider.verifyWebhook(malformed, signedHeader(malformed, WEBHOOK_SECRET))).toBeNull();
  });

  it("rejects a payload signed with the wrong secret", () => {
    const provider = new StripeProvider("sk_test", WEBHOOK_SECRET);
    const event = provider.verifyWebhook(payload, signedHeader(payload, "whsec_wrong_secret"));
    expect(event).toBeNull();
  });

  it("rejects a tampered body signed for a different payload", () => {
    const provider = new StripeProvider("sk_test", WEBHOOK_SECRET);
    const header = signedHeader(payload, WEBHOOK_SECRET);
    const tampered = JSON.stringify({ id: "evt_1", type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } });
    expect(provider.verifyWebhook(tampered, header)).toBeNull();
  });

  it("rejects when the signature header is missing", () => {
    const provider = new StripeProvider("sk_test", WEBHOOK_SECRET);
    expect(provider.verifyWebhook(payload, null)).toBeNull();
  });

  it("rejects when no webhook secret is configured, even with a well-formed header", () => {
    const provider = new StripeProvider("sk_test", undefined);
    expect(provider.verifyWebhook(payload, signedHeader(payload, WEBHOOK_SECRET))).toBeNull();
  });

  it("rejects a malformed signature header", () => {
    const provider = new StripeProvider("sk_test", WEBHOOK_SECRET);
    expect(provider.verifyWebhook(payload, "not-a-valid-header")).toBeNull();
  });
});

describe("StripeProvider.normalizeSubscription — provider payload mapping", () => {
  const provider = new StripeProvider("sk_test", WEBHOOK_SECRET);

  it("maps a Stripe subscription object's fields, converting unix seconds to ISO", () => {
    const normalized = provider.normalizeSubscription({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      current_period_start: 1_759_276_800,
      current_period_end: 1_761_955_200,
      cancel_at_period_end: false,
      trial_end: null,
      items: { data: [{ price: { id: "price_plus" } }] },
    });

    expect(normalized).toEqual({
      customerId: "cus_1",
      subscriptionId: "sub_1",
      priceId: "price_plus",
      status: "active",
      currentPeriodStart: new Date(1_759_276_800 * 1000).toISOString(),
      currentPeriodEnd: new Date(1_761_955_200 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: null,
    });
  });

  it("falls back to 'incomplete' for a status this app doesn't otherwise model (e.g. Stripe's 'paused' collection-pause state)", () => {
    const normalized = provider.normalizeSubscription({
      id: "sub_2",
      customer: "cus_2",
      status: "paused",
      items: { data: [] },
    });
    expect(normalized.status).toBe("incomplete");
    expect(normalized.priceId).toBeNull();
  });

  it("maps Stripe's 'unpaid' status directly rather than falling back (billing audit fix — was previously mapped to 'incomplete')", () => {
    const normalized = provider.normalizeSubscription({
      id: "sub_3",
      customer: "cus_3",
      status: "unpaid",
      items: { data: [] },
    });
    expect(normalized.status).toBe("unpaid");
  });

  it("reads the billing period from the subscription item, not the (now-absent in newer Stripe API versions) top-level fields — billing audit fix found via a live production payload", () => {
    const itemStart = 1_759_300_000;
    const itemEnd = 1_761_900_000;
    const normalized = provider.normalizeSubscription({
      id: "sub_4",
      customer: "cus_4",
      status: "active",
      // Top-level fields absent, as in a real payload from a newer Stripe API version.
      items: { data: [{ price: { id: "price_plus" }, current_period_start: itemStart, current_period_end: itemEnd }] },
    });
    expect(normalized.currentPeriodStart).toBe(new Date(itemStart * 1000).toISOString());
    expect(normalized.currentPeriodEnd).toBe(new Date(itemEnd * 1000).toISOString());
  });

  it("falls back to the top-level period fields when the item doesn't carry its own (older Stripe API versions)", () => {
    const normalized = provider.normalizeSubscription({
      id: "sub_5",
      customer: "cus_5",
      status: "active",
      current_period_start: 1_759_276_800,
      current_period_end: 1_761_955_200,
      items: { data: [{ price: { id: "price_plus" } }] },
    });
    expect(normalized.currentPeriodStart).toBe(new Date(1_759_276_800 * 1000).toISOString());
    expect(normalized.currentPeriodEnd).toBe(new Date(1_761_955_200 * 1000).toISOString());
  });
});

describe("planIdForStripePriceId — webhook must never guess a plan (STEP 16)", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("resolves the configured Plus/Pro price ids", () => {
    process.env.STRIPE_PRICE_ID_PLUS = "price_plus_123";
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_456";
    expect(planIdForStripePriceId("price_plus_123")).toBe("plus");
    expect(planIdForStripePriceId("price_pro_456")).toBe("pro");
  });

  it("returns null for an unrecognized price id rather than defaulting to any plan", () => {
    process.env.STRIPE_PRICE_ID_PLUS = "price_plus_123";
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_456";
    expect(planIdForStripePriceId("price_unknown")).toBeNull();
  });

  it("returns null for a null/undefined price id", () => {
    expect(planIdForStripePriceId(null)).toBeNull();
    expect(planIdForStripePriceId(undefined)).toBeNull();
  });
});
