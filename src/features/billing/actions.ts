"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingProvider, getStripePriceId } from "@/lib/billing/provider";
import { getClientEnv } from "@/config/env";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { trackEvent } from "@/lib/analytics";
import { checkRateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import type { PlanId } from "@/lib/billing/plans";
import type { Subscription } from "@/types/database";

export interface CheckoutActionResult {
  url?: string;
  error?: string;
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

/**
 * Ensures the signed-in user has a Stripe customer, creating one (and
 * bootstrapping their `subscriptions` row) if needed. Uses the admin
 * (service-role) client for the write — RLS deliberately gives the
 * authenticated role no insert/update policy on `subscriptions` (STEP 4/18:
 * a user must never be able to grant/modify their own plan), so this is one
 * of the few places server code intentionally bypasses RLS, and only to
 * persist a provider-issued customer id, never a plan or status value.
 */
async function ensureStripeCustomer(userId: string, email: string, existing: Subscription | null): Promise<string> {
  if (existing?.provider_customer_id) return existing.provider_customer_id;

  const provider = getBillingProvider();
  if (!provider) throw new Error("Billing provider not configured");

  const { customerId } = await provider.createCustomer({ userId, email });

  const admin = createAdminClient();
  await admin
    .from("subscriptions")
    .upsert({ user_id: userId, provider: "stripe", provider_customer_id: customerId }, { onConflict: "user_id" });

  return customerId;
}

/**
 * STEP 8 checkout flow, server half. Never trusts a client-supplied price:
 * `planId` selects one of exactly two server-known Stripe price IDs (Plus/
 * Pro) via `getStripePriceId()`; the actual `subscriptions` row is never
 * written here as "paid" — only the webhook, on provider confirmation, does
 * that (STEP 8: "Never activate paid access solely from redirect/success
 * page").
 */
export async function createCheckoutSessionAction(planId: PlanId): Promise<CheckoutActionResult> {
  const dict = await getRequestDictionary();

  if (planId !== "plus" && planId !== "pro") {
    return { error: dict.billing.errors.invalidPlan };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: dict.common.pleaseLogin };

  const rateLimit = await checkRateLimit(`billing-checkout:user:${user.id}`, { windowSeconds: 600, maxRequests: 10 });
  if (!rateLimit.allowed) return { error: dict.billing.errors.checkoutFailed };

  const provider = getBillingProvider();
  if (!provider) return { error: dict.billing.errors.providerUnavailable };

  const priceId = getStripePriceId(planId);
  if (!priceId) return { error: dict.billing.errors.invalidPlan };

  const { data: existing } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();

  if (existing && existing.status !== "free" && existing.status !== "canceled" && existing.status !== "incomplete") {
    return { error: dict.billing.errors.alreadySubscribed };
  }

  try {
    const customerId = await ensureStripeCustomer(user.id, user.email, existing as Subscription | null);
    const appUrl = getClientEnv().NEXT_PUBLIC_APP_URL;

    const session = await provider.createCheckoutSession({
      customerId,
      userId: user.id,
      priceId,
      successUrl: `${appUrl}/billing?checkout=success`,
      cancelUrl: `${appUrl}/billing?checkout=canceled`,
    });

    trackEvent("checkout_started", user.id, { plan: planId });
    return { url: session.url };
  } catch (error) {
    captureError(error, { route: "billing.createCheckoutSessionAction", provider: "stripe", userId: user.id });
    return { error: dict.billing.errors.checkoutFailed };
  }
}

/** STEP 9 — prefers Stripe's own hosted portal over custom card-management UI. */
export async function createPortalSessionAction(): Promise<CheckoutActionResult> {
  const dict = await getRequestDictionary();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const rateLimit = await checkRateLimit(`billing-portal:user:${user.id}`, { windowSeconds: 600, maxRequests: 10 });
  if (!rateLimit.allowed) return { error: dict.billing.errors.portalFailed };

  const provider = getBillingProvider();
  if (!provider) return { error: dict.billing.errors.providerUnavailable };

  const { data: existing } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  if (!existing?.provider_customer_id) return { error: dict.billing.errors.noBillingAccount };

  try {
    const appUrl = getClientEnv().NEXT_PUBLIC_APP_URL;
    const session = await provider.createPortalSession({
      customerId: existing.provider_customer_id,
      returnUrl: `${appUrl}/billing`,
    });
    return { url: session.url };
  } catch (error) {
    captureError(error, { route: "billing.createPortalSessionAction", provider: "stripe", userId: user.id });
    return { error: dict.billing.errors.portalFailed };
  }
}

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/**
 * STEP 10 cancel/resume. Calls the provider first (the only source of
 * truth for whether a cancellation is actually possible/valid), then
 * mirrors that *confirmed* result into `subscriptions` via the admin
 * client — this is not "trusting the client," it's persisting the outcome
 * of a server-to-provider call this same function just made. The webhook's
 * `customer.subscription.updated` event will arrive shortly after and
 * confirm/overwrite the same fields, so a missed or delayed webhook can
 * never leave the row stuck out of sync for long, and a duplicate webhook
 * delivery is a harmless no-op (idempotent upsert of the same values).
 */
export async function cancelSubscriptionAction(): Promise<ActionResult> {
  const dict = await getRequestDictionary();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const provider = getBillingProvider();
  if (!provider) return { error: dict.billing.errors.providerUnavailable };

  const { data: existing } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  if (!existing?.provider_subscription_id) return { error: dict.billing.errors.noActiveSubscription };

  try {
    await provider.cancelSubscription(existing.provider_subscription_id, true);
    const admin = createAdminClient();
    await admin.from("subscriptions").update({ cancel_at_period_end: true }).eq("user_id", user.id);
    return { success: true };
  } catch (error) {
    captureError(error, { route: "billing.cancelSubscriptionAction", provider: "stripe", userId: user.id });
    return { error: dict.billing.errors.cancelFailed };
  }
}

export async function resumeSubscriptionAction(): Promise<ActionResult> {
  const dict = await getRequestDictionary();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const provider = getBillingProvider();
  if (!provider) return { error: dict.billing.errors.providerUnavailable };

  const { data: existing } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  if (!existing?.provider_subscription_id || !existing.cancel_at_period_end) {
    return { error: dict.billing.errors.noActiveSubscription };
  }

  try {
    await provider.resumeSubscription(existing.provider_subscription_id);
    const admin = createAdminClient();
    await admin.from("subscriptions").update({ cancel_at_period_end: false }).eq("user_id", user.id);
    return { success: true };
  } catch (error) {
    captureError(error, { route: "billing.resumeSubscriptionAction", provider: "stripe", userId: user.id });
    return { error: dict.billing.errors.cancelFailed };
  }
}
