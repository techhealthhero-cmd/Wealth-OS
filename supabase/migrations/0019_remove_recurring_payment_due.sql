-- =============================================================================
-- WEALTH OS — Migration 0019: remove the dead `recurring_payment_due`
-- notification category
--
-- Production-hardening audit finding: `recurring_payment_due` was defined
-- in `financial_notifications.type`'s check constraint and had its own
-- `notification_preferences` opt-out column plus a real, user-facing
-- preferences checkbox (via `NOTIFICATION_CATEGORIES`) — but
-- `notifications-sync.ts`'s `syncNotifications()` never generated a
-- notification of this type. A user could toggle the checkbox forever and
-- it would do nothing.
--
-- Confirmed genuinely redundant, not just unwired: `getUpcomingBills()`
-- (which drives the `upcoming_bill` category, still present) already
-- covers every active recurring EXPENSE transaction AND every liability
-- due date — there is no distinct "recurring payment due" condition left
-- to wire separately without duplicating `upcoming_bill`'s own
-- notifications. Removed entirely rather than wired up or left as a
-- silent no-op.
--
-- Same two-part shape as every prior notification-type migration, in
-- reverse: narrow `financial_notifications.type`'s check constraint (TEXT+
-- CHECK, not a native enum — 0007_engagement.sql's convention) back to
-- exclude it, and drop the matching `notification_preferences` column.
-- Safe to drop outright — the app never wrote this type, so no real row
-- anywhere has `type = 'recurring_payment_due'`, and any stored user
-- preference value for it is meaningless once nothing reads it.
-- =============================================================================
alter table public.financial_notifications drop constraint financial_notifications_type_check;

alter table public.financial_notifications add constraint financial_notifications_type_check check (type in (
  'upcoming_bill', 'budget_near_limit', 'budget_exceeded',
  'subscription_detected', 'goal_milestone',
  'emergency_fund_milestone', 'debt_milestone', 'monthly_review_due',
  'mission_reminder', 'ai_checkin', 'priority_alert'
));

alter table public.notification_preferences drop column recurring_payment_due;
