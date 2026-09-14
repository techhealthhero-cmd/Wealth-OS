import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingProvider } from "@/lib/billing/provider";
import {
  isDuplicateEventError,
  buildSubscriptionUpsertPatch,
  buildSubscriptionCancelPatch,
  buildPastDuePatch,
  buildRecoveredPatch,
} from "@/lib/billing/webhook-logic";

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
    return new Response("Failed to record event", { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const userId = (event.data.metadata as Record<string, string> | undefined)?.user_id;
        const customerId = event.data.customer as string | undefined;
        if (userId && customerId) {
          await admin
            .from("subscriptions")
            .upsert({ user_id: userId, provider: "stripe", provider_customer_id: customerId }, { onConflict: "user_id" });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const normalized = provider.normalizeSubscription(event.data);
        const patch = buildSubscriptionUpsertPatch(normalized);
        if (!patch) break; // Unknown price id — never guess a plan from unverified data.

        const metadataUserId = (event.data.metadata as Record<string, string> | undefined)?.user_id;
        if (metadataUserId) {
          await admin.from("subscriptions").upsert({ user_id: metadataUserId, ...patch }, { onConflict: "user_id" });
        } else {
          // No metadata (shouldn't happen given checkout always sets it) —
          // fall back to matching the row already linked to this customer
          // rather than inventing a user_id.
          await admin.from("subscriptions").update(patch).eq("provider_customer_id", normalized.customerId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const normalized = provider.normalizeSubscription(event.data);
        await admin
          .from("subscriptions")
          .update(buildSubscriptionCancelPatch())
          .eq("provider_subscription_id", normalized.subscriptionId);
        break;
      }

      case "invoice.payment_failed": {
        const subscriptionId = event.data.subscription as string | undefined;
        if (subscriptionId) {
          await admin.from("subscriptions").update(buildPastDuePatch()).eq("provider_subscription_id", subscriptionId);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const subscriptionId = event.data.subscription as string | undefined;
        if (subscriptionId) {
          // A successful invoice on a subscription that was previously
          // past_due clears it back to active. Harmless no-op otherwise
          // (this fires on every renewal, not just recoveries).
          await admin
            .from("subscriptions")
            .update(buildRecoveredPatch())
            .eq("provider_subscription_id", subscriptionId)
            .eq("status", "past_due");
        }
        break;
      }

      default:
        // Every other event type is intentionally ignored — still a 200 so
        // Stripe doesn't retry indefinitely for an event this app has no
        // handler for.
        break;
    }
  } catch {
    return new Response("Processing error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
