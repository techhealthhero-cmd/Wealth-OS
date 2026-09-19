import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getTransactions, getCurrentMonthRange } from "@/features/transactions/queries";
import { getBudgetSummary } from "@/features/budget/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getLiabilities } from "@/features/liabilities/queries";
import { getGoals } from "@/features/goals/queries";
import { getIncomeSources } from "@/features/income-sources/queries";
import { getIncomeMissions } from "@/features/income-missions/queries";
import { calculateMonthsProtected } from "@/lib/financial/emergency-fund";
import { calculateSavingsContributions, calculateSavingsRate } from "@/lib/financial/calculations";
import { parseMoneyToCents } from "@/lib/financial/money";
import { calculateTrackingDaysStreak, calculateWeeklyStreak, calculateMonthlyReviewStreak } from "@/lib/financial/streaks";
import { calculateTotalXp, calculateLevel, type LevelProgress } from "@/lib/financial/xp";
import { generateWealthMissionCandidates, type WealthMissionInputs } from "@/lib/financial/wealth-missions";
import { toLocalDateString } from "@/lib/date";
import type { FinancialNotification, NotificationPreferences, WealthMission } from "@/types/database";
import { throwDbError } from "@/lib/db-error";

export async function getWealthMissions(): Promise<WealthMission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("wealth_missions").select("*").order("created_at", { ascending: true });
  if (error) throwDbError(error, "engagement.getWealthMissions", "Failed to load wealth missions");
  return data ?? [];
}

export async function getActiveWealthMissions(): Promise<WealthMission[]> {
  const missions = await getWealthMissions();
  return missions.filter((m) => m.status === "not_started" || m.status === "in_progress");
}

function recentDaysRange(days: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from: toLocalDateString(from), to: toLocalDateString(now) };
}

/** Gathers the real, live inputs the deterministic Wealth Mission generator needs — nothing here is invented or AI-derived. */
export async function getWealthMissionInputs(): Promise<WealthMissionInputs> {
  const { from: currentFrom, to: currentTo } = getCurrentMonthRange();
  const recent = recentDaysRange(30);
  const now = new Date();

  const [
    currentMonthTx,
    recentTx,
    budget,
    emergencyFund,
    essential,
    liabilities,
    goals,
    incomeSources,
    incomeMissions,
    pendingSubscriptions,
    monthlyReview,
  ] = await Promise.all([
    getTransactions({ from: currentFrom, to: currentTo }),
    getTransactions({ from: recent.from, to: recent.to }),
    getBudgetSummary(),
    getEmergencyFund(),
    getEssentialMonthlyExpenses(),
    getLiabilities(),
    getGoals(),
    getIncomeSources(),
    getIncomeMissions(),
    getPendingSubscriptionCount(),
    getMonthlyReviewForCurrentMonth(),
  ]);

  const emergencyFundCurrentCents = emergencyFund ? parseMoneyToCents(emergencyFund.current_amount) : 0;
  const trackingDaysStreak = calculateTrackingDaysStreak(recentTx.map((t) => new Date(t.transaction_date)), now);

  return {
    hasBudget: budget !== null,
    trackingDaysStreak,
    emergencyFundMonthsProtected: calculateMonthsProtected(emergencyFundCurrentCents, essential.cents),
    emergencyFundTargetMonths: emergencyFund?.target_months ? Number(emergencyFund.target_months) : 6,
    hasEmergencyFundSetUp: emergencyFund !== null,
    currentMonthSavingsCents: calculateSavingsContributions(currentMonthTx),
    hasDebt: liabilities.some((l) => l.include_in_net_worth),
    pendingSubscriptionCount: pendingSubscriptions,
    hasCompletedReviewThisMonth: monthlyReview?.completed_at != null,
    hasActiveGoals: goals.some((g) => g.status === "active"),
    activeIncomeSourceCount: incomeSources.filter((s) => s.is_active).length,
    savingsRatePercent: calculateSavingsRate(currentMonthTx),
    hasActiveIncomeMission: incomeMissions.some((m) => m.status === "not_started" || m.status === "in_progress"),
  };
}

async function getPendingSubscriptionCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("detected_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throwDbError(error, "engagement.getPendingSubscriptionCount", "Failed to load subscription count");
  return count ?? 0;
}

async function getMonthlyReviewForCurrentMonth() {
  const supabase = await createClient();
  const now = new Date();
  const { data, error } = await supabase
    .from("monthly_reviews")
    .select("completed_at")
    .eq("year", now.getFullYear())
    .eq("month", now.getMonth() + 1)
    .maybeSingle();
  if (error) throwDbError(error, "engagement.getMonthlyReviewForCurrentMonth", "Failed to load monthly review");
  return data;
}

/** Wealth Missions currently applicable given live data — the same deterministic generator `syncWealthMissions()` uses to decide what to insert. */
export async function getWealthMissionCandidates() {
  const inputs = await getWealthMissionInputs();
  return generateWealthMissionCandidates(inputs);
}

export interface UserProgress {
  level: LevelProgress;
  weeklyStreak: number;
  monthlyReviewStreak: number;
  trackingDaysStreak: number;
}

export async function getUserProgress(): Promise<UserProgress> {
  const supabase = await createClient();
  const now = new Date();
  const recent = recentDaysRange(90);

  const [{ data: events, error: eventsError }, { data: reviews, error: reviewsError }, recentTx] = await Promise.all([
    supabase.from("xp_events").select("xp_amount"),
    supabase.from("monthly_reviews").select("year, month").not("completed_at", "is", null),
    getTransactions({ from: recent.from, to: recent.to }),
  ]);
  if (eventsError) throwDbError(eventsError, "engagement.getUserProgress", "Failed to load XP events");
  if (reviewsError) throwDbError(reviewsError, "engagement.getUserProgress", "Failed to load monthly reviews");

  const totalXp = calculateTotalXp((events ?? []).map((e) => ({ xpAmount: e.xp_amount })));
  const reviewDates = (reviews ?? []).map((r) => new Date(r.year, r.month - 1, 1));

  return {
    level: calculateLevel(totalXp),
    weeklyStreak: calculateWeeklyStreak(recentTx.map((t) => new Date(t.transaction_date)), now),
    monthlyReviewStreak: calculateMonthlyReviewStreak(reviewDates, now),
    trackingDaysStreak: calculateTrackingDaysStreak(recentTx.map((t) => new Date(t.transaction_date)), now),
  };
}

export async function getNotifications(options?: { unreadOnly?: boolean; limit?: number }): Promise<FinancialNotification[]> {
  const supabase = await createClient();
  let query = supabase.from("financial_notifications").select("*").order("created_at", { ascending: false });
  if (options?.unreadOnly) query = query.eq("is_read", false);
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throwDbError(error, "engagement.getNotifications", "Failed to load notifications");
  return data ?? [];
}

/** Cheap count-only query for a header badge dot — no rows fetched. */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("financial_notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throwDbError(error, "engagement.getUnreadNotificationCount", "Failed to load unread notification count");
  return count ?? 0;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notification_preferences").select("*").maybeSingle();
  if (error) throwDbError(error, "engagement.getNotificationPreferences", "Failed to load notification preferences");
  return data;
}
