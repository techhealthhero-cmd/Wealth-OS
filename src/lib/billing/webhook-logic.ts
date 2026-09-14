import { planIdForStripePriceId } from "@/lib/billing/provider";
import type { NormalizedSubscription } from "@/lib/billing/provider";
import type { PlanId } from "@/lib/billing/plans";

/**
 * Pure webhook decision logic, separated from `/api/billing/webhook/route.ts`
 * so STEP 17's "webhook: subscription update/cancellation" and "duplicate
 * event" test cases don't require mocking the Supabase admin client — same
 * "pure core, thin DB wrapper" split used throughout this codebase.
 */

/** Postgres unique_violation — the idempotency signal from inserting into `billing_events`. A duplicate delivery must be treated as already-handled, not an error. */
export function isDuplicateEventError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

export type SubscriptionPatch = Partial<{
  provider: "stripe";
  provider_customer_id: string;
  provider_subscription_id: string;
  provider_price_id: string | null;
  plan: PlanId;
  status: NormalizedSubscription["status"];
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
}>;

/**
 * `customer.subscription.created`/`.updated` -> the row patch to apply.
 * Returns null when the event's price id doesn't map to a known plan
 * (STEP 16: never guess a plan from unverified/unrecognized data).
 */
export function buildSubscriptionUpsertPatch(normalized: NormalizedSubscription): SubscriptionPatch | null {
  const plan = planIdForStripePriceId(normalized.priceId);
  if (!plan) return null;

  return {
    provider: "stripe",
    provider_customer_id: normalized.customerId,
    provider_subscription_id: normalized.subscriptionId,
    provider_price_id: normalized.priceId,
    plan,
    status: normalized.status,
    current_period_start: normalized.currentPeriodStart,
    current_period_end: normalized.currentPeriodEnd,
    cancel_at_period_end: normalized.cancelAtPeriodEnd,
    trial_end: normalized.trialEnd,
  };
}

/** `customer.subscription.deleted` -> the row patch. Plan is deliberately left as-is; `status: "canceled"` alone already drops entitlement (see `statusGrantsEntitlement`). */
export function buildSubscriptionCancelPatch(): SubscriptionPatch {
  return { status: "canceled", cancel_at_period_end: false };
}

export function buildPastDuePatch(): SubscriptionPatch {
  return { status: "past_due" };
}

export function buildRecoveredPatch(): SubscriptionPatch {
  return { status: "active" };
}
