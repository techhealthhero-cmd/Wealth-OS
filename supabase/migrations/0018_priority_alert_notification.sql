-- =============================================================================
-- WEALTH OS — Migration 0018: Priority Engine notification type
--
-- The Notifications page (/notifications) only ever surfaced routine,
-- narrow events (an overdue bill, a budget limit, a milestone reached) — it
-- never surfaced the app's own Next Best Action Engine
-- (src/lib/financial/priority-engine.ts), which is CLAUDE.md's documented
-- "what is the next best financial action for this user?" core loop and
-- already ranks 8 issue types (negative cash flow > no emergency fund >
-- high-interest debt > missed goal > income gap > low savings rate > weak
-- income growth > no investment contribution). It was computed live for the
-- dashboard's NextBestActionCard but never turned into a notification a user
-- could come back to on /notifications.
--
-- No new financial math — src/features/engagement/notifications-sync.ts now
-- calls the existing getLifeStageAndPriorities()/buildNextBestActionText(),
-- unchanged, and turns the single most urgent priority into one notification
-- (dedupe key includes the priority type + month, so a change in what's most
-- urgent re-notifies, but the same standing issue doesn't repeat daily).
--
-- Same two-part shape as every prior notification-type migration (e.g.
-- 0017_ai_checkin.sql): extend financial_notifications.type's check
-- constraint (TEXT+CHECK, not a native enum — 0007_engagement.sql's
-- convention), and add the matching opt-out column to
-- notification_preferences, defaulting true like every other category.
-- =============================================================================
alter table public.financial_notifications drop constraint financial_notifications_type_check;

alter table public.financial_notifications add constraint financial_notifications_type_check check (type in (
  'upcoming_bill', 'budget_near_limit', 'budget_exceeded',
  'recurring_payment_due', 'subscription_detected', 'goal_milestone',
  'emergency_fund_milestone', 'debt_milestone', 'monthly_review_due',
  'mission_reminder', 'ai_checkin', 'priority_alert'
));

alter table public.notification_preferences add column priority_alert boolean not null default true;
