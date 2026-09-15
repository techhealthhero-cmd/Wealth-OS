-- =============================================================================
-- WEALTH OS — Migration 0011: Billing audit hardening
--
-- Found during a full billing-system audit (post-Day 8, after the first real
-- Stripe test-mode checkout succeeded in production):
--
-- 1. Out-of-order webhook delivery could resurrect a canceled subscription.
--    Stripe does not guarantee webhook delivery order (documented behavior,
--    not a hypothetical) — if a stale "active" `customer.subscription.updated`
--    event is delivered/retried AFTER a newer "canceled" event for the same
--    subscription, the old handler would blindly overwrite the row back to
--    active, silently un-canceling a user who correctly canceled. Fixes this
--    by recording the source event's own timestamp (`last_webhook_event_at`)
--    and refusing to apply any subscription-state patch older than what's
--    already stored — see src/lib/billing/webhook-logic.ts's
--    `isStaleWebhookEvent()` and the guard in
--    src/app/api/billing/webhook/route.ts.
--
-- 2. `status` didn't model Stripe's `unpaid` status (sent when Stripe's
--    automatic retry schedule for a past-due invoice is exhausted without
--    the subscription being canceled outright). It previously fell through
--    to `incomplete` in `normalizeSubscription()`'s fallback — safe from an
--    entitlement standpoint (both are already non-entitling statuses) but
--    an inaccurate status label for the user/admin to see. Added as its own
--    recognized, still-non-entitling status.
--
-- Purely additive: a new nullable column and a widened CHECK constraint.
-- Does not touch, migrate, or invalidate any existing row.
-- =============================================================================

alter table public.subscriptions
  add column last_webhook_event_at timestamptz;

alter table public.subscriptions
  drop constraint subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check check (status in (
    'free', 'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid'
  ));
