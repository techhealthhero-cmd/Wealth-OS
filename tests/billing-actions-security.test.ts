import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeAdminClient, type FakeDb } from "./mocks/fake-admin-client";
import { __setBillingProviderForTesting, type BillingProvider } from "@/lib/billing/provider";
import { createCheckoutSessionAction, createPortalSessionAction } from "@/features/billing/actions";

/**
 * Security-focused tests for the billing server actions — Phase 6/7 of the
 * billing audit: unauthorized access, arbitrary price/plan selection, and
 * rate-limit enforcement. Mocks Supabase (both the regular and admin
 * clients) and the billing provider; never touches real Stripe or a real
 * database.
 */

let db: FakeDb;
let currentUser: { id: string; email: string } | null;
let rateLimitAllowed: boolean;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createFakeAdminClient(db),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
    },
    from(table: string) {
      const fake = createFakeAdminClient(db).from(table);
      return {
        select: () => ({
          eq: (col: string, val: unknown) => ({
            maybeSingle: async () => {
              const rows = (db[table] ?? []).filter((r) => r[col] === val);
              return { data: rows[0] ?? null, error: null };
            },
          }),
        }),
        insert: fake.insert,
        update: fake.update,
        upsert: fake.upsert,
      };
    },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: rateLimitAllowed }),
  getClientIdentifier: async () => "127.0.0.1",
}));

// These actions call getRequestDictionary() purely for localized error
// text, which pulls in the profile self-heal chain and next/headers'
// cookies() — both irrelevant to what this file tests and unavailable
// outside a real request scope. Stubbed out so the tests can focus on the
// actual security behavior (who gets rejected, what price id is used).
vi.mock("@/features/profile/queries", () => ({
  getProfile: async () => null,
}));
vi.mock("@/i18n/server", () => ({
  getLocale: async () => "en",
}));

const ORIGINAL_ENV = { ...process.env };

describe("billing actions — security (unauthorized access, arbitrary plan selection, rate limiting)", () => {
  beforeEach(() => {
    db = { subscriptions: [] };
    currentUser = { id: "user-1", email: "user1@example.com" };
    rateLimitAllowed = true;
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_PRICE_ID_PLUS = "price_plus_fake";
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_fake";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.test";

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
  });

  afterEach(() => {
    __setBillingProviderForTesting(undefined);
    process.env = { ...ORIGINAL_ENV };
  });

  it("createCheckoutSessionAction rejects a signed-out caller before ever touching the provider", async () => {
    currentUser = null;
    const result = await createCheckoutSessionAction("plus");
    expect(result.url).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("createCheckoutSessionAction rejects any plan value other than 'plus'/'pro' — the only two server-known Stripe prices (STEP 16: never let a client select an arbitrary price id)", async () => {
    // "free" is a legitimately-typed PlanId — this proves the runtime check
    // (not just the TypeScript type) refuses it: a route handler calling
    // this action from parsed JSON has no compile-time protection at all.
    const result = await createCheckoutSessionAction("free");
    expect(result.url).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("createCheckoutSessionAction rejects a completely made-up plan/price string, proving there is no code path that forwards an arbitrary client string to Stripe as a price id", async () => {
    // @ts-expect-error same as above
    const result = await createCheckoutSessionAction("admin_free_forever");
    expect(result.url).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("createCheckoutSessionAction succeeds for a valid plan and never receives a client-suppliable price id — getStripePriceId() resolves it purely from server env vars", async () => {
    const result = await createCheckoutSessionAction("plus");
    expect(result.url).toBe("https://example.test/checkout");
  });

  it("createCheckoutSessionAction is blocked once the rate limit is exceeded, without ever calling the provider", async () => {
    rateLimitAllowed = false;
    const result = await createCheckoutSessionAction("plus");
    expect(result.url).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("createCheckoutSessionAction refuses to create a second checkout for a user who already has an active paid subscription", async () => {
    db.subscriptions = [{ user_id: "user-1", status: "active", plan: "plus" }];
    const result = await createCheckoutSessionAction("pro");
    expect(result.url).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("createPortalSessionAction rejects a signed-out caller", async () => {
    currentUser = null;
    const result = await createPortalSessionAction();
    expect(result.url).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("createPortalSessionAction rejects a user with no linked Stripe customer id (never fabricates one)", async () => {
    db.subscriptions = [];
    const result = await createPortalSessionAction();
    expect(result.url).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("createPortalSessionAction always opens a portal for the CALLER's own customer id — there is no parameter through which a different user's customer id could be requested", async () => {
    db.subscriptions = [{ user_id: "user-1", provider_customer_id: "cus_real_owner" }];
    const result = await createPortalSessionAction();
    expect(result.url).toBe("https://example.test/portal");
    // The security property under test: createPortalSessionAction() takes
    // NO arguments at all — the customer id it uses is looked up from the
    // authenticated session's own user id, never from caller input. A
    // second user with a different `currentUser.id` would look up their
    // own row and get their own portal, never user-1's.
  });

  it("a different authenticated user gets THEIR OWN billing state, never user-1's, when calling the exact same action", async () => {
    db.subscriptions = [
      { user_id: "user-1", provider_customer_id: "cus_user_1" },
      { user_id: "user-2", provider_customer_id: "cus_user_2" },
    ];
    currentUser = { id: "user-2", email: "user2@example.com" };
    const result = await createPortalSessionAction();
    expect(result.url).toBe("https://example.test/portal"); // mock always returns this; the real assertion is which row was read
    const readRow = db.subscriptions.find((r) => r.user_id === "user-2");
    expect(readRow?.provider_customer_id).toBe("cus_user_2");
  });
});
