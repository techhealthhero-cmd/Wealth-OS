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
  const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } });

  it("accepts a correctly signed payload", () => {
    const provider = new StripeProvider("sk_test", WEBHOOK_SECRET);
    const event = provider.verifyWebhook(payload, signedHeader(payload, WEBHOOK_SECRET));
    expect(event).not.toBeNull();
    expect(event?.id).toBe("evt_1");
    expect(event?.type).toBe("customer.subscription.updated");
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

  it("falls back to 'incomplete' for a status this app doesn't otherwise model", () => {
    const normalized = provider.normalizeSubscription({
      id: "sub_2",
      customer: "cus_2",
      status: "unpaid",
      items: { data: [] },
    });
    expect(normalized.status).toBe("incomplete");
    expect(normalized.priceId).toBeNull();
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
