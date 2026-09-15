import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingProvider } from "@/lib/billing/provider";
import {
  isDuplicateEventError,
  isStaleWebhookEvent,
  buildSubscriptionUpsertPatch,
  buildSubscriptionCancelPatch,
  buildPastDuePatch,
  buildRecoveredPatch,
} from "@/lib/billing/webhook-logic";
import { captureError, captureMessage } from "@/lib/observability";
import { trackEvent } from "@/lib/analytics";
import type { createAdminClient as CreateAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof CreateAdminClient>;

/**
 * Billing-audit hardening: applied to the metadata-driven path
 * (`customer.subscription.created`/`.updated`, keyed by `user_id`). A brand
 * new subscriber has no existing row to be stale against — insert
 * unconditionally. An existing row is only updated if the incoming event is
 * not older than the last one already applied (`isStaleWebhookEvent()`),
 * so a delayed/retried stale event can never resurrect a since-canceled
 * subscription.
 */
async function upsertSubscriptionIfNotStale(
  admin: AdminClient,
  userId: string,
  eventCreatedAt: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { data: existing } = await admin.from("subscriptions").select("last_webhook_event_at").eq("user_id", userId).maybeSingle();

  if (!existing) {
    await admin.from("subscriptions").insert({ user_id: userId, ...patch });
    return;
  }

  if (isStaleWebhookEvent(existing.last_webhook_event_at, eventCreatedAt)) {
    captureMessage("Stale webhook event ignored (older than the last-applied event for this subscription)", {
      route: "api/billing/webhook",
      provider: "stripe",
      extra: { matchColumn: "user_id", eventCreatedAt },
    });
    return;
  }

  await admin.from("subscriptions").update(patch).eq("user_id", userId);
}

/**
 * Same staleness guard as above, for the `provider_subscription_id`/
 * `provider_customer_id`-matched paths (subscription deleted, invoice
 * failed/succeeded, and the fallback when metadata is missing). These paths
 * only ever update an existing row — a subscription must already have been
 * created (and thus have a row) before Stripe can delete it or invoice it.
 */
async function updateSubscriptionIfNotStale(
  admin: AdminClient,
  matchColumn: "provider_subscription_id" | "provider_customer_id",
  matchValue: string,
  eventCreatedAt: string,
  patch: Record<string, unknown>,
  extraFilter?: { column: string; value: string }
): Promise<void> {
  const { data: existing } = await admin.from("subscriptions").select("last_webhook_event_at").eq(matchColumn, matchValue).maybeSingle();
  if (!existing) return;

  if (isStaleWebhookEvent(existing.last_webhook_event_at, eventCreatedAt)) {
    captureMessage("Stale webhook event ignored (older than the last-applied event for this subscription)", {
      route: "api/billing/webhook",
      provider: "stripe",
      extra: { matchColumn, eventCreatedAt },
    });
    return;
  }

  let query = admin.from("subscriptions").update(patch).eq(matchColumn, matchValue);
  if (extraFilter) query = query.eq(extraFilter.column, extraFilter.value);
  await query;
}

/**
 * STEP 15 webhook handler — the only place `subscriptions` state is ever
 * written as "paid." Order of operations is fixed and load-bearing:
 *
 *   1. Verify the signature against the RAW body (never trust arbitrary
 *      JSON before this passes).
 *   2. Record the event id in `billing_events` FIRST, using its unique
 *      (provider, provider_event_id) constraint as the idempotency guard —
 *      a duplicate delivery hits a unique-violation and returns 200
 *      immediately without touching `subscriptions` a second time.
 *   3. Only then apply the state change, via the service-role admin client
 *      (the same client used everywhere else in this codebase for
 *      privileged writes — RLS gives the authenticated role no write access
 *      to this table at all).
 *
 * Returns 200 for everything it successfully evaluates (including event
 * types it deliberately ignores) so Stripe doesn't endlessly retry a
 * delivery this app has already handled or intentionally skips; returns a
 * non-200 only for signature failures or unexpected processing errors,
 * which SHOULD be retried.
 */
export async function POST(request: Request) {
  const provider = getBillingProvider();
  if (!provider) return new Response("Billing not configured", { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const event = provider.verifyWebhook(rawBody, signature);
  if (!event) return new Response("Invalid signature", { status: 400 });

  const admin = createAdminClient();

  const { error: dedupeError } = await admin.from("billing_events").insert({
    provider: "stripe",
    provider_event_id: event.id,
    event_type: event.type,
    payload: event.data,
  });

  if (dedupeError) {
    // Unique_violation on (provider, provider_event_id): this exact event
    // was already processed — treat as success, not an error, so Stripe
    // stops retrying it.
    if (isDuplicateEventError(dedupeError)) return new Response("Already processed", { status: 200 });
    captureError(dedupeError, { route: "api/billing/webhook", provider: "stripe", operation: "record_event" });
    return new Response("Failed to record event", { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const userId = (event.data.metadata as Record<string, string> | undefined)?.user_id;
        const customerId = event.data.customer as string | undefined;
        if (userId && customerId) {
          await upsertSubscriptionIfNotStale(admin, userId, event.createdAt, {
            provider: "stripe",
            provider_customer_id: customerId,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const normalized = provider.normalizeSubscription(event.data);
        const patch = buildSubscriptionUpsertPatch(normalized, event.createdAt);
        if (!patch) {
          captureMessage("Webhook subscription event with unrecognized price id — ignored, never guessed a plan", {
            route: "api/billing/webhook",
            provider: "stripe",
            operation: event.type,
          });
          break;
        }

        const metadataUserId = (event.data.metadata as Record<string, string> | undefined)?.user_id;
        if (metadataUserId) {
          await upsertSubscriptionIfNotStale(admin, metadataUserId, event.createdAt, patch);
        } else {
          // No metadata (shouldn't happen given checkout always sets it) —
          // fall back to matching the row already linked to this customer
          // rather than inventing a user_id.
          await updateSubscriptionIfNotStale(admin, "provider_customer_id", normalized.customerId, event.createdAt, patch);
        }

        if (metadataUserId && (patch.status === "active" || patch.status === "trialing")) {
          trackEvent("subscription_activated", metadataUserId, { plan: patch.plan, status: patch.status });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const normalized = provider.normalizeSubscription(event.data);
        const metadataUserId = (event.data.metadata as Record<string, string> | undefined)?.user_id;
        await updateSubscriptionIfNotStale(
          admin,
          "provider_subscription_id",
          normalized.subscriptionId,
          event.createdAt,
          buildSubscriptionCancelPatch(event.createdAt)
        );
        if (metadataUserId) trackEvent("subscription_canceled", metadataUserId);
        break;
      }

      case "invoice.payment_failed": {
        const subscriptionId = event.data.subscription as string | undefined;
        if (subscriptionId) {
          await updateSubscriptionIfNotStale(
            admin,
            "provider_subscription_id",
            subscriptionId,
            event.createdAt,
            buildPastDuePatch(event.createdAt)
          );
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const subscriptionId = event.data.subscription as string | undefined;
        if (subscriptionId) {
          // A successful invoice on a subscription that was previously
          // past_due clears it back to active. Harmless no-op otherwise
          // (this fires on every renewal, not just recoveries).
          await updateSubscriptionIfNotStale(
            admin,
            "provider_subscription_id",
            subscriptionId,
            event.createdAt,
            buildRecoveredPatch(event.createdAt),
            { column: "status", value: "past_due" }
          );
        }
        break;
      }

      default:
        // Every other event type is intentionally ignored — still a 200 so
        // Stripe doesn't retry indefinitely for an event this app has no
        // handler for.
        break;
    }
  } catch (error) {
    captureError(error, { route: "api/billing/webhook", provider: "stripe", operation: event.type });
    return new Response("Processing error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
