import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getTransactions, getCurrentMonthRange } from "@/features/transactions/queries";
import { getLiabilities } from "@/features/liabilities/queries";
import { getGoals } from "@/features/goals/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getNetWorthBreakdown, getNetWorthSnapshots } from "@/features/net-worth/queries";
import {
  calculateIncome,
  calculateMonthlyCashFlow,
  calculateSavingsRate,
} from "@/lib/financial/calculations";
import { calculateMonthsProtected } from "@/lib/financial/emergency-fund";
import { calculateGoalProgress, calculateRequiredMonthlyContribution } from "@/lib/financial/goals";
import { toLocalDateString } from "@/lib/date";
import { parseMoneyToCents } from "@/lib/financial/money";
import {
  calculateCashFlowScore,
  calculateDebtHealthScore,
  calculateEmergencyFundScore,
  calculateGoalProgressScore,
  calculateIncomeGrowthScore,
  calculateNetWorthGrowthScore,
  calculateSavingsScore,
  calculateWealthScore,
  getWealthScoreImprovementActions,
  WEALTH_SCORE_CALCULATION_VERSION,
  type WealthScoreAction,
  type WealthScoreResult,
} from "@/lib/financial/wealth-score";
import type { WealthScore } from "@/types/database";

function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

export async function getLatestStoredWealthScore(): Promise<WealthScore | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wealth_scores")
    .select("*")
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Failed to load wealth score");
  return data;
}

export interface WealthScoreComputation {
  result: WealthScoreResult;
  actions: WealthScoreAction[];
  hasNetWorthHistory: boolean;
  hasIncomeHistory: boolean;
}

/** Gathers every input the Wealth Score formula needs and computes it fresh (deterministic — no LLM). */
export async function computeWealthScore(): Promise<WealthScoreComputation> {
  const { from: currentFrom, to: currentTo } = getCurrentMonthRange();
  const { from: prevFrom, to: prevTo } = previousMonthRange();

  const [currentMonthTx, prevMonthTx, liabilities, goals, emergencyFund, essential, netWorth, snapshots] =
    await Promise.all([
      getTransactions({ from: currentFrom, to: currentTo }),
      getTransactions({ from: prevFrom, to: prevTo }),
      getLiabilities(),
      getGoals(),
      getEmergencyFund(),
      getEssentialMonthlyExpenses(),
      getNetWorthBreakdown(),
      getNetWorthSnapshots(2),
    ]);

  const incomeCents = calculateIncome(currentMonthTx);
  const cashFlowCents = calculateMonthlyCashFlow(currentMonthTx);
  const savingsRatePercent = calculateSavingsRate(currentMonthTx);
  const prevIncomeCents = prevMonthTx.length > 0 ? calculateIncome(prevMonthTx) : null;

  const minimumDebtPaymentsCents = liabilities
    .filter((l) => l.include_in_net_worth)
    .reduce((sum, l) => sum + (l.minimum_payment ? parseMoneyToCents(l.minimum_payment) : 0), 0);

  const emergencyFundCurrentCents = emergencyFund ? parseMoneyToCents(emergencyFund.current_amount) : 0;
  const monthsProtected = calculateMonthsProtected(emergencyFundCurrentCents, essential.cents);
  const targetMonths = emergencyFund?.target_months ? Number(emergencyFund.target_months) : 6;

  // Two snapshots (today + previous) means at least one prior day to compare against.
  const previousNetWorthCents =
    snapshots.length >= 2 ? parseMoneyToCents(snapshots[snapshots.length - 2].net_worth) : null;

  const activeGoals = goals.filter((g) => g.status === "active");
  const goalProgressPercents = activeGoals.map((g) =>
    calculateGoalProgress(parseMoneyToCents(g.current_amount), parseMoneyToCents(g.target_amount))
  );

  const netWorthGrowth = calculateNetWorthGrowthScore(netWorth.netWorthCents, previousNetWorthCents);
  const incomeGrowth = calculateIncomeGrowthScore(incomeCents, prevIncomeCents);

  const components = {
    cashFlowScore: calculateCashFlowScore(incomeCents, cashFlowCents),
    savingsScore: calculateSavingsScore(savingsRatePercent),
    emergencyFundScore: calculateEmergencyFundScore(monthsProtected, targetMonths),
    debtHealthScore: calculateDebtHealthScore(incomeCents, minimumDebtPaymentsCents),
    netWorthGrowthScore: netWorthGrowth.score,
    incomeGrowthScore: incomeGrowth.score,
    goalProgressScore: calculateGoalProgressScore(goalProgressPercents),
  };

  const result = calculateWealthScore(components);

  const actions = getWealthScoreImprovementActions({
    components,
    essentialMonthlyExpensesCents: essential.cents,
    emergencyFundCurrentCents,
    emergencyFundTargetMonths: targetMonths,
    incomeCents,
    cashFlowCents,
    savingsRatePercent,
    minimumDebtPaymentsCents,
    goals: activeGoals.map((g) => ({
      name: g.name,
      progressPercent: calculateGoalProgress(parseMoneyToCents(g.current_amount), parseMoneyToCents(g.target_amount)),
      requiredMonthlyContributionCents: calculateRequiredMonthlyContribution(
        parseMoneyToCents(g.current_amount),
        parseMoneyToCents(g.target_amount),
        g.target_date ? new Date(g.target_date) : null
      ),
    })),
  });

  return {
    result,
    actions,
    hasNetWorthHistory: netWorthGrowth.hasHistory,
    hasIncomeHistory: incomeGrowth.hasHistory,
  };
}

/**
 * Computes the score fresh (so the dashboard always reflects current data)
 * and persists a new history row only once per calendar day — otherwise
 * every dashboard reload would insert a duplicate row into the
 * append-only wealth_scores history.
 */
export async function ensureTodaysWealthScore(): Promise<WealthScoreComputation> {
  const [computation, latestStored] = await Promise.all([computeWealthScore(), getLatestStoredWealthScore()]);

  const today = toLocalDateString(new Date());
  const latestStoredDate = latestStored ? toLocalDateString(new Date(latestStored.calculated_at)) : undefined;
  if (latestStoredDate !== today) {
    await storeWealthScore(computation.result);
  }

  return computation;
}

export async function storeWealthScore(result: WealthScoreResult): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("wealth_scores").insert({
    user_id: user.id,
    total_score: result.totalScore,
    cash_flow_score: result.cashFlowScore,
    savings_score: result.savingsScore,
    emergency_fund_score: result.emergencyFundScore,
    debt_health_score: result.debtHealthScore,
    net_worth_growth_score: result.netWorthGrowthScore,
    income_growth_score: result.incomeGrowthScore,
    goal_progress_score: result.goalProgressScore,
    calculation_version: WEALTH_SCORE_CALCULATION_VERSION,
  });
}
