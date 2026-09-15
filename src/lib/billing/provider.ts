import "server-only";

import crypto from "node:crypto";

import type { PlanId } from "@/lib/billing/plans";
import { getAppEnv, isLiveStripeKey } from "@/config/env";
import { captureError } from "@/lib/observability";

/**
 * Provider-agnostic billing abstraction (Day 7 STEP 7) — the billing
 * equivalent of `src/features/ai/lib/provider.ts`'s `AIProvider`. Nothing
 * outside this file calls Stripe's REST API directly; swapping or adding a
 * provider means writing one new class here, not touching checkout/portal/
 * webhook route handlers.
 */

export interface CreateCustomerParams {
  userId: string;
  email: string;
}

export interface CreateCustomerResult {
  customerId: string;
}

export interface CreateCheckoutSessionParams {
  customerId: string;
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutSessionResult {
  url: string;
  sessionId: string;
}

export interface CreatePortalSessionParams {
  customerId: string;
  returnUrl: string;
}

export interface CreatePortalSessionResult {
  url: string;
}

export interface NormalizedSubscription {
  customerId: string;
  subscriptionId: string;
  priceId: string | null;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  /** The event envelope's own `created` (unix seconds), as ISO — used to detect and reject out-of-order/stale redelivery, see webhook-logic.ts's `isStaleWebhookEvent()`. */
  createdAt: string;
}

export interface BillingProvider {
  readonly name: string;
  createCustomer(params: CreateCustomerParams): Promise<CreateCustomerResult>;
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CreateCheckoutSessionResult>;
  createPortalSession(params: CreatePortalSessionParams): Promise<CreatePortalSessionResult>;
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void>;
  resumeSubscription(subscriptionId: string): Promise<void>;
  /** Verifies the raw webhook signature and returns the parsed event, or null if verification fails. Never parses/trusts the body before this check passes. */
  verifyWebhook(rawBody: string, signatureHeader: string | null): WebhookEvent | null;
  normalizeSubscription(raw: Record<string, unknown>): NormalizedSubscription;
}

const STRIPE_API_URL = "https://api.stripe.com/v1";

/** Server-only lookup of a Stripe price ID for a paid plan — see plans.ts for why this doesn't live in the client-safe plan config module. */
export function getStripePriceId(planId: "plus" | "pro"): string | undefined {
  return planId === "plus" ? process.env.STRIPE_PRICE_ID_PLUS : process.env.STRIPE_PRICE_ID_PRO;
}

/** Reverse lookup — the webhook handler must resolve plan from the provider's own price ID, never from anything the client sent. */
export function planIdForStripePriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_PLUS) return "plus";
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  return null;
}

function toFormBody(params: Record<string, string | number | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) usp.append(key, String(value));
  }
  return usp.toString();
}

/**
 * Direct `fetch` against the Stripe REST API — no `stripe` SDK dependency,
 * consistent with this codebase's existing pattern for external HTTP APIs
 * (Anthropic in provider.ts, the Supabase Management API used to apply
 * migrations). `server-only` at the top of this module plus the fact that
 * `apiKey`/`webhookSecret` are only ever read from `process.env.STRIPE_*`
 * (never `NEXT_PUBLIC_*`) keeps both fully out of the browser bundle.
 */
/** Exported for direct unit testing of `verifyWebhook`/`normalizeSubscription` (pure, no network) without going through `getBillingProvider()`'s env-based caching. */
export class StripeProvider implements BillingProvider {
  readonly name = "stripe";
  private readonly apiKey: string;
  private readonly webhookSecret: string | undefined;

  constructor(apiKey: string, webhookSecret: string | undefined) {
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
  }

  private async request(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`${STRIPE_API_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: toFormBody(flattenForStripe(body)),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`Stripe API error (${res.status}) on ${path}: ${errorBody.slice(0, 500)}`);
    }

    return res.json();
  }

  async createCustomer({ userId, email }: CreateCustomerParams): Promise<CreateCustomerResult> {
    const data = await this.request("/customers", {
      email,
      "metadata[user_id]": userId,
    });
    return { customerId: data.id as string };
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CreateCheckoutSessionResult> {
    const data = await this.request("/checkout/sessions", {
      customer: params.customerId,
      mode: "subscription",
      "line_items[0][price]": params.priceId,
      "line_items[0][quantity]": 1,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      "metadata[user_id]": params.userId,
      "subscription_data[metadata][user_id]": params.userId,
    });
    return { url: data.url as string, sessionId: data.id as string };
  }

  async createPortalSession(params: CreatePortalSessionParams): Promise<CreatePortalSessionResult> {
    const data = await this.request("/billing_portal/sessions", {
      customer: params.customerId,
      return_url: params.returnUrl,
    });
    return { url: data.url as string };
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void> {
    if (cancelAtPeriodEnd) {
      await this.request(`/subscriptions/${subscriptionId}`, { cancel_at_period_end: true });
    } else {
      await fetch(`${STRIPE_API_URL}/subscriptions/${subscriptionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    await this.request(`/subscriptions/${subscriptionId}`, { cancel_at_period_end: false });
  }

  /**
   * Manual Stripe signature verification (the documented `Stripe-Signature`
   * scheme: `t=<timestamp>,v1=<hmac>`), implemented with Node's built-in
   * `crypto` rather than the Stripe SDK. Rejects (returns null) on a missing
   * header, missing webhook secret, malformed header, or a signature
   * mismatch — the caller must never proceed on a null result.
   */
  verifyWebhook(rawBody: string, signatureHeader: string | null): WebhookEvent | null {
    if (!signatureHeader || !this.webhookSecret) return null;

    const parts = Object.fromEntries(
      signatureHeader.split(",").map((part) => {
        const [key, value] = part.split("=");
        return [key, value];
      })
    );
    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return null;

    const expected = crypto.createHmac("sha256", this.webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");

    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawBody) as {
        id: string;
        type: string;
        created: number;
        data: { object: Record<string, unknown> };
      };
      return {
        id: parsed.id,
        type: parsed.type,
        data: parsed.data.object,
        createdAt: new Date(parsed.created * 1000).toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Billing-audit fix: Stripe's newer API versions no longer populate
   * `current_period_start`/`current_period_end` on the Subscription object
   * itself — that moved to each subscription item
   * (`items.data[].current_period_start/end`), since a multi-item
   * subscription can have items on different billing cycles. Confirmed live
   * against this app's own production webhook payloads (API version
   * 2026-07-29 and later): the top-level fields are absent, so reading only
   * them silently produced `null` period dates on an otherwise-correct
   * active subscription. Reads the first item's period as the
   * subscription's overall period — correct for this app, which never
   * creates a multi-item subscription (one price per checkout session) —
   * and falls back to the top-level fields for forward/backward
   * compatibility with any Stripe API version that still sets them.
   */
  normalizeSubscription(raw: Record<string, unknown>): NormalizedSubscription {
    const status = raw.status as string;
    const validStatuses: NormalizedSubscription["status"][] = [
      "trialing",
      "active",
      "past_due",
      "canceled",
      "incomplete",
      "unpaid",
    ];
    const items = raw.items as
      | { data?: { price?: { id?: string }; current_period_start?: number; current_period_end?: number }[] }
      | undefined;
    const firstItem = items?.data?.[0];
    const priceId = firstItem?.price?.id ?? null;

    const periodStart = firstItem?.current_period_start ?? (raw.current_period_start as number | undefined);
    const periodEnd = firstItem?.current_period_end ?? (raw.current_period_end as number | undefined);

    return {
      customerId: raw.customer as string,
      subscriptionId: raw.id as string,
      priceId,
      status: validStatuses.includes(status as NormalizedSubscription["status"]) ? (status as NormalizedSubscription["status"]) : "incomplete",
      currentPeriodStart: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancelAtPeriodEnd: Boolean(raw.cancel_at_period_end),
      trialEnd: raw.trial_end ? new Date((raw.trial_end as number) * 1000).toISOString() : null,
    };
  }
}

/** Stripe's form-encoding needs bracketed keys kept as literal strings, not nested objects — this just filters out any accidental nested object values so `toFormBody` only ever sees primitives. */
function flattenForStripe(body: Record<string, unknown>): Record<string, string | number | boolean | undefined> {
  const out: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}

let cachedProvider: BillingProvider | null | undefined;

/**
 * Returns null (never throws) when billing isn't configured — every caller
 * must handle that as a real, expected state, not an error to crash on. No
 * Stripe keys exist in this environment as of Day 7 (see PROJECT_STATUS.md
 * "Billing Test Mode"), so this returns null in local/dev/test today; every
 * checkout/portal/webhook route is written to degrade cleanly on that.
 *
 * Staging-isolation audit: defense-in-depth against the exact incident this
 * audit found (a Preview/staging deployment holding a Stripe LIVE key,
 * which let a "test" checkout place a real charge). `getServerEnv()`'s
 * `assertProductionConsistency()` already refuses to let the app start at
 * all in that state — this second, independent check means even if this
 * function is ever reached without that startup check having run (e.g. a
 * future refactor, a different entry point), a staging deployment still
 * cannot obtain a working live-mode provider: it gets `null` — the same
 * safe "not configured" state as no key at all — rather than a provider
 * that would actually call Stripe.
 */
export function getBillingProvider(): BillingProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    cachedProvider = null;
    return null;
  }

  if (getAppEnv() !== "production" && isLiveStripeKey(apiKey)) {
    captureError(new Error("Refused to initialize a live-mode Stripe provider outside production"), {
      route: "billing.getBillingProvider",
      provider: "stripe",
      extra: { appEnv: getAppEnv() },
    });
    cachedProvider = null;
    return null;
  }

  cachedProvider = new StripeProvider(apiKey, process.env.STRIPE_WEBHOOK_SECRET);
  return cachedProvider;
}

/** Test-only: overrides the cached provider (e.g. with a mock) or clears it. */
export function __setBillingProviderForTesting(provider: BillingProvider | null | undefined) {
  cachedProvider = provider;
}
