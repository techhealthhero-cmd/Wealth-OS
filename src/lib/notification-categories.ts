import type { NotificationType } from "@/types/database";

/**
 * Single source of truth for the notification-preference toggle list — was
 * previously hardcoded identically in both notification-preferences-form.tsx
 * (the UI) and engagement/actions.ts (updateNotificationPreferences' form
 * parsing), which could silently drift if a new category was added to only
 * one of them. Order here is the order the preferences form renders in.
 */
export const NOTIFICATION_CATEGORIES: readonly NotificationType[] = [
  "upcoming_bill",
  "budget_near_limit",
  "budget_exceeded",
  "recurring_payment_due",
  "subscription_detected",
  "goal_milestone",
  "emergency_fund_milestone",
  "debt_milestone",
  "monthly_review_due",
  "mission_reminder",
  "ai_checkin",
  "priority_alert",
];
