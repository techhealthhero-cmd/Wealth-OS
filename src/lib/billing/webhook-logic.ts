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

/**
 * Billing-audit fix: Stripe does not guarantee webhook delivery order. If a
 * stale event (e.g. an "active" `customer.subscription.updated` delayed by
 * a retry) is processed AFTER a newer event already moved the row to
 * "canceled", blindly applying the stale patch would silently resurrect a
 * canceled user's entitlement. Compares the incoming event's own `created`
 * timestamp against the last-applied one stored on the row
 * (`last_webhook_event_at`); a `null` stored value (no prior event
 * recorded — including every row that existed before this column was
 * added) always allows the incoming event through.
 */
export function isStaleWebhookEvent(existingLastEventAt: string | null, incomingEventCreatedAt: string): boolean {
  if (!existingLastEventAt) return false;
  return new Date(incomingEventCreatedAt).getTime() < new Date(existingLastEventAt).getTime();
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
  last_webhook_event_at: string;
}>;

/**
 * `customer.subscription.created`/`.updated` -> the row patch to apply.
 * Returns null when the event's price id doesn't map to a known plan
 * (STEP 16: never guess a plan from unverified/unrecognized data).
 */
export function buildSubscriptionUpsertPatch(normalized: NormalizedSubscription, eventCreatedAt: string): SubscriptionPatch | null {
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
    last_webhook_event_at: eventCreatedAt,
  };
}

/** `customer.subscription.deleted` -> the row patch. Plan is deliberately left as-is; `status: "canceled"` alone already drops entitlement (see `statusGrantsEntitlement`). */
export function buildSubscriptionCancelPatch(eventCreatedAt: string): SubscriptionPatch {
  return { status: "canceled", cancel_at_period_end: false, last_webhook_event_at: eventCreatedAt };
}

export function buildPastDuePatch(eventCreatedAt: string): SubscriptionPatch {
  return { status: "past_due", last_webhook_event_at: eventCreatedAt };
}

export function buildRecoveredPatch(eventCreatedAt: string): SubscriptionPatch {
  return { status: "active", last_webhook_event_at: eventCreatedAt };
}
