-- =============================================================================
-- WEALTH OS — Migration 0017: proactive AI check-in notification type
--
-- Supports the Pro-only proactive AI Money Coach check-in (cron —
-- src/app/api/cron/ai-checkin/route.ts, gated via the new
-- PlanLimits.aiCheckinsPerMonth in src/lib/billing/plans.ts, pro: 1). The
-- AI messages the user once a month, unprompted, instead of only replying
-- when asked — this adds the notification-bell side of that (the chat
-- message itself lands as a normal ai_conversations/ai_messages row, no
-- schema change needed there).
--
-- Two additions, both extending existing 0007_engagement.sql structures
-- rather than creating new tables:
--   1. financial_notifications.type's check constraint gains 'ai_checkin'
--      (it's `text + check`, not a native enum, per that file's own
--      "TEXT+CHECK instead of native enums" convention — a plain
--      drop/re-add, not a destructive column change).
--   2. notification_preferences gains an ai_checkin opt-out toggle,
--      defaulting true like every other category — a Pro user who doesn't
--      want proactive messages can turn just this one off without losing
--      any other notification category.
-- =============================================================================
alter table public.financial_notifications drop constraint financial_notifications_type_check;

alter table public.financial_notifications add constraint financial_notifications_type_check check (type in (
  'upcoming_bill', 'budget_near_limit', 'budget_exceeded',
  'recurring_payment_due', 'subscription_detected', 'goal_milestone',
  'emergency_fund_milestone', 'debt_milestone', 'monthly_review_due',
  'mission_reminder', 'ai_checkin'
));

alter table public.notification_preferences add column ai_checkin boolean not null default true;
