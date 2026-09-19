import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getTransactions } from "@/features/transactions/queries";
import { getBudgetSummary } from "@/features/budget/queries";
import { getNetWorthBreakdown, getNetWorthSnapshots } from "@/features/net-worth/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getGoals } from "@/features/goals/queries";
import { getIncomeProfileSummary } from "@/features/income-profile/queries";
import { getIncomeTarget } from "@/features/income-target/queries";
import {
  calculateExpenses,
  calculateIncome,
  calculateMonthlyCashFlow,
  calculateSavingsRate,
  calculateDebtReductionContributions,
} from "@/lib/financial/calculations";
import { calculateMonthsProtected } from "@/lib/financial/emergency-fund";
import { calculateGoalProgress } from "@/lib/financial/goals";
import { calculateIncomeGap } from "@/lib/financial/income-gap";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import type { MonthlyReview } from "@/types/database";
import { throwDbError } from "@/lib/db-error";

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

export interface MonthlyReviewSnapshot {
  incomeCents: number;
  expensesCents: number;
  cashFlowCents: number;
  savingsRatePercent: number;
  netWorthChangeCents: number | null;
  budgetPercentUsed: number | null;
  debtPaidCents: number;
  emergencyFundMonthsProtected: number | null;
  goalsProgressPercent: number | null;
  incomeGapCents: number | null;
  missionsCompletedCount: number;
}

/** Builds the deterministic snapshot for a given month — every figure comes from real data, the same domain functions used elsewhere. AI may summarize this afterward but never computes it. */
export async function buildMonthlyReviewSnapshot(year: number, month: number): Promise<MonthlyReviewSnapshot> {
  const { from, to } = monthRange(year, month);
  const supabase = await createClient();

  const [
    transactions,
    budget,
    netWorth,
    netWorthSnapshots,
    emergencyFund,
    essential,
    goals,
    incomeProfileSummary,
    incomeTarget,
    { count: wealthMissionsCompleted },
    { count: incomeMissionsCompleted },
  ] = await Promise.all([
    getTransactions({ from, to }),
    getBudgetSummary(new Date(year, month - 1, 1)),
    getNetWorthBreakdown(),
    getNetWorthSnapshots(2),
    getEmergencyFund(),
    getEssentialMonthlyExpenses(),
    getGoals(),
    getIncomeProfileSummary(),
    getIncomeTarget(),
    supabase
      .from("wealth_missions")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", `${from}T00:00:00Z`)
      .lte("completed_at", `${to}T23:59:59Z`),
    supabase
      .from("income_missions")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", `${from}T00:00:00Z`)
      .lte("updated_at", `${to}T23:59:59Z`),
  ]);

  const previousSnapshot = netWorthSnapshots.length >= 2 ? parseMoneyToCents(netWorthSnapshots[netWorthSnapshots.length - 2].net_worth) : null;
  const netWorthChangeCents = previousSnapshot !== null ? netWorth.netWorthCents - previousSnapshot : null;

  const emergencyFundMonthsProtected = emergencyFund
    ? calculateMonthsProtected(parseMoneyToCents(emergencyFund.current_amount), essential.cents)
    : null;

  const activeGoals = goals.filter((g) => g.status === "active");
  const goalsProgressPercent =
    activeGoals.length > 0
      ? activeGoals.reduce((sum, g) => sum + calculateGoalProgress(parseMoneyToCents(g.current_amount), parseMoneyToCents(g.target_amount)), 0) /
        activeGoals.length
      : null;

  const gap = calculateIncomeGap({
    targetMonthlyIncomeCents:
      incomeTarget?.target_monthly_income !== null && incomeTarget?.target_monthly_income !== undefined
        ? parseMoneyToCents(incomeTarget.target_monthly_income)
        : null,
    averageMonthlyIncomeCents: incomeProfileSummary.profile.averageMonthlyIncomeCents,
  });

  return {
    incomeCents: calculateIncome(transactions),
    expensesCents: calculateExpenses(transactions),
    cashFlowCents: calculateMonthlyCashFlow(transactions),
    savingsRatePercent: calculateSavingsRate(transactions),
    netWorthChangeCents,
    budgetPercentUsed: budget?.overall.percentUsed ?? null,
    debtPaidCents: calculateDebtReductionContributions(transactions),
    emergencyFundMonthsProtected,
    goalsProgressPercent,
    incomeGapCents: gap.hasTarget ? gap.gapCents : null,
    missionsCompletedCount: (wealthMissionsCompleted ?? 0) + (incomeMissionsCompleted ?? 0),
  };
}

export async function getMonthlyReview(year: number, month: number): Promise<MonthlyReview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_reviews")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) throwDbError(error, "monthly-review.getMonthlyReview", "Failed to load monthly review");
  return data;
}

export async function getReviewHistory(limit = 12): Promise<MonthlyReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_reviews")
    .select("*")
    .not("completed_at", "is", null)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(limit);
  if (error) throwDbError(error, "monthly-review.getReviewHistory", "Failed to load review history");
  return data ?? [];
}
