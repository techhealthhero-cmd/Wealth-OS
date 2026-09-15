import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAppEnv,
  isLiveStripeKey,
  isTestStripeKey,
  resolveSupabaseConfig,
  resolveServiceRoleKey,
  assertProductionConsistency,
} from "@/config/env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getAppEnv — staging/production signal", () => {
  it("reads an explicit NEXT_PUBLIC_APP_ENV", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    expect(getAppEnv()).toBe("staging");
  });

  it("defaults to 'production' (the stricter, more-validated path) when unset or garbage", () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    expect(getAppEnv()).toBe("production");
    process.env.NEXT_PUBLIC_APP_ENV = "not-a-real-value";
    expect(getAppEnv()).toBe("production");
  });

  it("recognizes 'development'", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "development";
    expect(getAppEnv()).toBe("development");
  });
});

describe("isLiveStripeKey / isTestStripeKey — Stripe's own key-format prefix, not an inference", () => {
  it("recognizes a live-mode key", () => {
    expect(isLiveStripeKey("sk_live_abc123")).toBe(true);
    expect(isLiveStripeKey("sk_test_abc123")).toBe(false);
  });

  it("recognizes a test-mode key", () => {
    expect(isTestStripeKey("sk_test_abc123")).toBe(true);
    expect(isTestStripeKey("sk_live_abc123")).toBe(false);
  });

  it("treats undefined/empty as neither", () => {
    expect(isLiveStripeKey(undefined)).toBe(false);
    expect(isTestStripeKey(undefined)).toBe(false);
    expect(isLiveStripeKey("")).toBe(false);
  });
});

describe("resolveSupabaseConfig — staging project isolation", () => {
  const PROD = { NEXT_PUBLIC_SUPABASE_URL: "https://prod-project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "prod-anon-key" };

  it("uses the primary (production) project when NEXT_PUBLIC_APP_ENV is production, even if staging vars happen to be set", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    const result = resolveSupabaseConfig({
      ...PROD,
      NEXT_PUBLIC_STAGING_SUPABASE_URL: "https://staging-project.supabase.co",
      NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY: "staging-anon-key",
    });
    expect(result).toEqual({ url: PROD.NEXT_PUBLIC_SUPABASE_URL, anonKey: PROD.NEXT_PUBLIC_SUPABASE_ANON_KEY, isStaging: false });
  });

  it("uses the separate staging project when in staging AND staging vars are configured — the actual fix for the audited bug", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    const result = resolveSupabaseConfig({
      ...PROD,
      NEXT_PUBLIC_STAGING_SUPABASE_URL: "https://staging-project.supabase.co",
      NEXT_PUBLIC_STAGING_SUPABASE_ANON_KEY: "staging-anon-key",
    });
    expect(result).toEqual({ url: "https://staging-project.supabase.co", anonKey: "staging-anon-key", isStaging: true });
  });

  it("falls back to the primary project when in staging but staging vars are NOT configured — reproduces today's actual shared-database state, not a crash", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    const result = resolveSupabaseConfig({ ...PROD });
    expect(result).toEqual({ url: PROD.NEXT_PUBLIC_SUPABASE_URL, anonKey: PROD.NEXT_PUBLIC_SUPABASE_ANON_KEY, isStaging: false });
  });

  it("falls back to the primary project when only ONE of the two staging vars is set (a half-configured staging project must not silently mix projects)", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    const result = resolveSupabaseConfig({ ...PROD, NEXT_PUBLIC_STAGING_SUPABASE_URL: "https://staging-project.supabase.co" });
    expect(result.isStaging).toBe(false);
  });
});

describe("resolveServiceRoleKey — kept in lockstep with resolveSupabaseConfig", () => {
  it("uses the staging service-role key only in staging with both configured", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    expect(
      resolveServiceRoleKey({ SUPABASE_SERVICE_ROLE_KEY: "prod-key", STAGING_SUPABASE_SERVICE_ROLE_KEY: "staging-key" })
    ).toBe("staging-key");
  });

  it("uses the production service-role key in production even if a staging one is set", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    expect(
      resolveServiceRoleKey({ SUPABASE_SERVICE_ROLE_KEY: "prod-key", STAGING_SUPABASE_SERVICE_ROLE_KEY: "staging-key" })
    ).toBe("prod-key");
  });

  it("falls back to the production key in staging when no staging key is configured", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    expect(resolveServiceRoleKey({ SUPABASE_SERVICE_ROLE_KEY: "prod-key" })).toBe("prod-key");
  });
});

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
};

describe("assertProductionConsistency — staging must never hold a live Stripe key (the actual incident this audit found)", () => {
  it("throws when NEXT_PUBLIC_APP_ENV is staging and STRIPE_SECRET_KEY looks like a live key — this is the exact bug found live in production", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    expect(() =>
      assertProductionConsistency({
        ...BASE_ENV,
        STRIPE_SECRET_KEY: "sk_live_real_key_shape",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
        STRIPE_PRICE_ID_PLUS: "price_plus",
        STRIPE_PRICE_ID_PRO: "price_pro",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      })
    ).toThrow(/LIVE-mode key/);
  });

  it("passes when staging holds a test-mode key", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    expect(() =>
      assertProductionConsistency({
        ...BASE_ENV,
        STRIPE_SECRET_KEY: "sk_test_fake",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
        STRIPE_PRICE_ID_PLUS: "price_plus",
        STRIPE_PRICE_ID_PRO: "price_pro",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      })
    ).not.toThrow();
  });

  it("passes when production holds a live-mode key (the correct, intended state)", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    expect(() =>
      assertProductionConsistency({
        ...BASE_ENV,
        STRIPE_SECRET_KEY: "sk_live_real_key_shape",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
        STRIPE_PRICE_ID_PLUS: "price_plus",
        STRIPE_PRICE_ID_PRO: "price_pro",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      })
    ).not.toThrow();
  });

  it("does not throw for a production+test-key mismatch (a warning-worthy business bug, not a safety hazard) but does not silently pass either — verified via console.warn being called", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    assertProductionConsistency({
      ...BASE_ENV,
      STRIPE_SECRET_KEY: "sk_test_fake",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      STRIPE_PRICE_ID_PLUS: "price_plus",
      STRIPE_PRICE_ID_PRO: "price_pro",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("accepts a staging-only service-role key (STAGING_SUPABASE_SERVICE_ROLE_KEY) as satisfying the 'billing needs a service-role key' requirement", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    expect(() =>
      assertProductionConsistency({
        ...BASE_ENV,
        STRIPE_SECRET_KEY: "sk_test_fake",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
        STRIPE_PRICE_ID_PLUS: "price_plus",
        STRIPE_PRICE_ID_PRO: "price_pro",
        STAGING_SUPABASE_SERVICE_ROLE_KEY: "staging-service-role-key",
      })
    ).not.toThrow();
  });

  it("never includes the actual live key value in the thrown error message", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    try {
      assertProductionConsistency({
        ...BASE_ENV,
        STRIPE_SECRET_KEY: "sk_live_super_secret_do_not_leak",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
        STRIPE_PRICE_ID_PLUS: "price_plus",
        STRIPE_PRICE_ID_PRO: "price_pro",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      });
      throw new Error("expected assertProductionConsistency to throw");
    } catch (err) {
      expect((err as Error).message).not.toContain("super_secret_do_not_leak");
    }
  });
});
