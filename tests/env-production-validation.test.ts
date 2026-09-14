import { describe, expect, it } from "vitest";

import { assertProductionConsistency } from "@/config/env";

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
};

describe("assertProductionConsistency — Day 8 STEP 2 production env guard", () => {
  it("passes when no billing vars are set at all (Free-only launch is valid)", () => {
    expect(() => assertProductionConsistency({ ...BASE_ENV })).not.toThrow();
  });

  it("passes when all four Stripe vars and the service role key are set", () => {
    expect(() =>
      assertProductionConsistency({
        ...BASE_ENV,
        STRIPE_SECRET_KEY: "sk_live_x",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
        STRIPE_PRICE_ID_PLUS: "price_plus",
        STRIPE_PRICE_ID_PRO: "price_pro",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      })
    ).not.toThrow();
  });

  it("throws when only STRIPE_SECRET_KEY is set (partial billing config)", () => {
    expect(() => assertProductionConsistency({ ...BASE_ENV, STRIPE_SECRET_KEY: "sk_live_x" })).toThrow(/partially configured/i);
  });

  it("throws when three of four Stripe vars are set", () => {
    expect(() =>
      assertProductionConsistency({
        ...BASE_ENV,
        STRIPE_SECRET_KEY: "sk_live_x",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
        STRIPE_PRICE_ID_PLUS: "price_plus",
      })
    ).toThrow(/partially configured/i);
  });

  it("throws when all four Stripe vars are set but the service role key is missing", () => {
    expect(() =>
      assertProductionConsistency({
        ...BASE_ENV,
        STRIPE_SECRET_KEY: "sk_live_x",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
        STRIPE_PRICE_ID_PLUS: "price_plus",
        STRIPE_PRICE_ID_PRO: "price_pro",
      })
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("never includes an actual secret value in its error message", () => {
    try {
      assertProductionConsistency({ ...BASE_ENV, STRIPE_SECRET_KEY: "sk_live_super_secret_value" });
      throw new Error("expected assertProductionConsistency to throw");
    } catch (err) {
      expect((err as Error).message).not.toContain("sk_live_super_secret_value");
    }
  });
});
