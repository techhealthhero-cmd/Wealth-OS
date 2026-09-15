import crypto from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeAdminClient, type FakeDb } from "./mocks/fake-admin-client";
import { __setBillingProviderForTesting } from "@/lib/billing/provider";
import { POST } from "@/app/api/billing/webhook/route";

// Mock the admin client factory so the route's `createAdminClient()` call
// returns our in-memory fake instead of a real Supabase connection — this
// is a genuine "mocked integration test" exercising the real route.ts
// dispatch/staleness-guard logic end-to-end, never touching a real
// database or Stripe (STEP 7 requirement: "Do not create brittle tests
// that depend on real production resources"). `vi.mock` calls are hoisted
// above these imports by Vitest's transform, so `db` (declared below with
// `let`) is safely assigned before any test runs despite the temporal-
// dead-zone-looking order here.
let db: FakeDb;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createFakeAdminClient(db),
}));

const WEBHOOK_SECRET = "whsec_test_only_fake_secret";
const PLUS_PRICE_ID = "price_plus_fake";

function signedHeader(rawBody: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function stripeEvent(id: string, type: string, created: number, object: Record<string, unknown>) {
  return JSON.stringify({ id, type, created, data: { object } });
}

async function postWebhook(body: string, signature: string | null) {
  const headers = new Headers();
  if (signature) headers.set("stripe-signature", signature);
  const request = new Request("http://localhost/api/billing/webhook", { method: "POST", body, headers });
  return POST(request);
}

const ORIGINAL_ENV = { ...process.env };

describe("/api/billing/webhook — integration (mocked admin client, fake signed Stripe events, no real Stripe/DB)", () => {
  beforeEach(() => {
    db = { subscriptions: [], billing_events: [] };
    process.env.STRIPE_PRICE_ID_PLUS = PLUS_PRICE_ID;
    __setBillingProviderForTesting(undefined); // force re-read of env-based provider
  });

  afterEach(() => {
    __setBillingProviderForTesting(undefined);
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns 503 when billing isn't configured (no Stripe keys)", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await postWebhook("{}", null);
    expect(res.status).toBe(503);
  });

  it("returns 400 for a missing signature header", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const res = await postWebhook("{}", null);
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid signature", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const res = await postWebhook("{}", "t=1,v1=deadbeef");
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed JSON body even with a technically-valid-format signature applied to garbage", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const garbage = "{not valid json";
    const res = await postWebhook(garbage, signedHeader(garbage));
    expect(res.status).toBe(400);
  });

  describe("with billing configured", () => {
    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = "sk_test_fake";
      process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    });

    it("checkout.session.completed with metadata creates a subscriptions row linking customer id", async () => {
      const body = stripeEvent("evt_1", "checkout.session.completed", 1000, {
        customer: "cus_1",
        metadata: { user_id: "user-1" },
      });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
      expect(db.subscriptions).toEqual([{ user_id: "user-1", provider: "stripe", provider_customer_id: "cus_1" }]);
    });

    it("checkout.session.completed with missing metadata does not crash and writes nothing", async () => {
      const body = stripeEvent("evt_2", "checkout.session.completed", 1000, { customer: "cus_1" });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
      expect(db.subscriptions).toEqual([]);
    });

    it("customer.subscription.created activates the correct plan for a brand-new subscriber", async () => {
      const body = stripeEvent("evt_3", "customer.subscription.created", 1000, {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: { user_id: "user-1" },
        items: { data: [{ price: { id: PLUS_PRICE_ID } }] },
      });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
      expect(db.subscriptions).toHaveLength(1);
      expect(db.subscriptions[0]).toMatchObject({ user_id: "user-1", plan: "plus", status: "active" });
    });

    it("customer.subscription.created with an unrecognized price id never guesses a plan (STEP 16)", async () => {
      const body = stripeEvent("evt_4", "customer.subscription.created", 1000, {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: { user_id: "user-1" },
        items: { data: [{ price: { id: "price_totally_unknown" } }] },
      });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
      expect(db.subscriptions).toEqual([]);
    });

    it("customer.subscription.updated updates the existing row for the same user", async () => {
      db.subscriptions = [{ user_id: "user-1", plan: "free", status: "free", last_webhook_event_at: null }];
      const body = stripeEvent("evt_5", "customer.subscription.updated", 2000, {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: { user_id: "user-1" },
        items: { data: [{ price: { id: PLUS_PRICE_ID } }] },
      });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
      expect(db.subscriptions[0]).toMatchObject({ plan: "plus", status: "active" });
    });

    it("a STALE customer.subscription.updated (older than the last-applied event) is ignored — the actual out-of-order-delivery bug this audit found and fixed", async () => {
      db.subscriptions = [
        { user_id: "user-1", plan: "free", status: "canceled", last_webhook_event_at: new Date(5000 * 1000).toISOString() },
      ];
      const staleBody = stripeEvent("evt_stale", "customer.subscription.updated", 1000, {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: { user_id: "user-1" },
        items: { data: [{ price: { id: PLUS_PRICE_ID } }] },
      });
      const res = await postWebhook(staleBody, signedHeader(staleBody));
      expect(res.status).toBe(200);
      // Must still show canceled — the stale "active" event must NOT have resurrected it.
      expect(db.subscriptions[0].status).toBe("canceled");
    });

    it("customer.subscription.deleted marks the row canceled by provider_subscription_id", async () => {
      db.subscriptions = [
        { user_id: "user-1", plan: "plus", status: "active", provider_subscription_id: "sub_1", cancel_at_period_end: false, last_webhook_event_at: null },
      ];
      const body = stripeEvent("evt_6", "customer.subscription.deleted", 3000, { id: "sub_1", customer: "cus_1", status: "canceled" });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
      expect(db.subscriptions[0]).toMatchObject({ status: "canceled", cancel_at_period_end: false });
    });

    it("invoice.payment_failed marks the matching subscription past_due", async () => {
      db.subscriptions = [{ user_id: "user-1", plan: "plus", status: "active", provider_subscription_id: "sub_1", last_webhook_event_at: null }];
      const body = stripeEvent("evt_7", "invoice.payment_failed", 4000, { subscription: "sub_1" });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
      expect(db.subscriptions[0].status).toBe("past_due");
    });

    it("invoice.payment_succeeded clears past_due back to active", async () => {
      db.subscriptions = [{ user_id: "user-1", plan: "plus", status: "past_due", provider_subscription_id: "sub_1", last_webhook_event_at: null }];
      const body = stripeEvent("evt_8", "invoice.payment_succeeded", 5000, { subscription: "sub_1" });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
      expect(db.subscriptions[0].status).toBe("active");
    });

    it("invoice.payment_succeeded is a no-op when the subscription was already active (only clears past_due)", async () => {
      db.subscriptions = [{ user_id: "user-1", plan: "plus", status: "active", provider_subscription_id: "sub_1", last_webhook_event_at: null }];
      const body = stripeEvent("evt_9", "invoice.payment_succeeded", 5000, { subscription: "sub_1" });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
      expect(db.subscriptions[0].status).toBe("active");
    });

    it("an unknown/unhandled event type is ignored safely and still returns 200 (never crashes, never retried forever)", async () => {
      const body = stripeEvent("evt_10", "some.future.event.type", 6000, { foo: "bar" });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
    });

    it("duplicate delivery of the exact same event id is a no-op the second time (idempotency)", async () => {
      const body = stripeEvent("evt_11", "customer.subscription.created", 1000, {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: { user_id: "user-1" },
        items: { data: [{ price: { id: PLUS_PRICE_ID } }] },
      });
      const first = await postWebhook(body, signedHeader(body));
      expect(first.status).toBe(200);
      expect(db.subscriptions).toHaveLength(1);

      // Redeliver the identical event (Stripe retries do this).
      const second = await postWebhook(body, signedHeader(body));
      expect(second.status).toBe(200);
      expect(db.subscriptions).toHaveLength(1); // not duplicated
      expect(db.billing_events).toHaveLength(1); // recorded exactly once
    });

    it("a checkout.session.completed with a user id that doesn't match any real user still writes safely scoped to that id (no cross-user write is possible since the id is the primary key)", async () => {
      const body = stripeEvent("evt_12", "checkout.session.completed", 1000, {
        customer: "cus_imposter",
        metadata: { user_id: "user-attacker-cannot-choose-this-its-from-verified-stripe-metadata" },
      });
      const res = await postWebhook(body, signedHeader(body));
      expect(res.status).toBe(200);
      expect(db.subscriptions).toHaveLength(1);
      expect(db.subscriptions[0].user_id).toBe("user-attacker-cannot-choose-this-its-from-verified-stripe-metadata");
      // The key security property: this user_id came from the verified,
      // signed Stripe payload's metadata — never from anything the caller
      // of this HTTP endpoint could supply directly (there is no other
      // input to this route besides the signed body).
    });
  });
});
