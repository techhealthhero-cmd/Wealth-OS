import "server-only";

/**
 * Controlled financial tools — the ONLY way the AI feature reads financial
 * data. Every function here:
 *   - operates only for the currently-authenticated user (via the existing
 *     Supabase server client + RLS — never accepts a user id parameter)
 *   - returns a plain, typed, already-summarized object — never a raw DB
 *     row, never an internal UUID unless a value is genuinely needed
 *   - calls the same deterministic domain functions (src/lib/financial/*)
 *     the rest of the app uses — the AI never computes a financial number
 *     itself, it only narrates numbers these tools hand it
 *
 * The model never generates SQL and never queries a table directly; it can
 * only ever receive what these functions choose to return.
 */

import { getDashboardData } from "@/features/dashboard/queries";
import { getTransactions, getCurrentMonthRange } from "@/features/transactions/queries";
import { getCategories } from "@/features/categories/queries";
import { getBudgetSummary } from "@/features/budget/queries";
import { getNetWorthBreakdown, getNetWorthSnapshots } from "@/features/net-worth/queries";
import { getGoals } from "@/features/goals/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getSafeToSpend } from "@/features/safe-to-spend/queries";
import { getLatestStoredWealthScore } from "@/features/wealth-score/queries";
import { getLiabilities } from "@/features/liabilities/queries";
import { getDebtPlannerSummary } from "@/features/debt-planner/queries";
import { getForecastScenarios, getForecastStartingState, scenarioRowToAssumptions } from "@/features/forecast/queries";
import { getMoneyYearSummary } from "@/features/money-year/queries";
import { getLifeStageAndPriorities } from "@/features/life-stage/queries";
import { calculateExpenses, calculateIncome, calculateMonthlyCashFlow } from "@/lib/financial/calculations";
import { calculateMonthsProtected, calculateEmergencyFundTarget } from "@/lib/financial/emergency-fund";
import {
  calculateAmountRemaining,
  calculateGoalProgress,
  calculateGoalScheduleStatus,
  calculateRequiredMonthlyContribution,
} from "@/lib/financial/goals";
import { calculateForecast } from "@/lib/financial/forecast";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import type {
  BudgetStatusTool,
  CashFlowTool,
  DebtPlanTool,
  DebtSummaryTool,
  EmergencyFundTool,
  FinancialSnapshotTool,
  ForecastSummaryTool,
  GoalProgressTool,
  IncomeSummaryTool,
  LifeStageTool,
  MoneyYearProgressTool,
  NetWorthTool,
  PriorityTool,
  RecentTransactionsSummaryTool,
  SafeToSpendTool,
  WealthScoreTool,
} from "@/features/ai/types";

function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

export async function getFinancialSummary(): Promise<FinancialSnapshotTool> {
  const data = await getDashboardData();
  return {
    currencyCode: "THB",
    monthLabel: toLocalDateString(new Date()).slice(0, 7),
    incomeCents: data.incomeCents,
    expensesCents: data.expensesCents,
    cashFlowCents: data.cashFlowCents,
    savingsRatePercent: data.savingsRatePercent,
    hasAnyData: data.hasAnyData,
  };
}

export async function getMonthlyCashFlow(): Promise<CashFlowTool> {
  const { from, to } = getCurrentMonthRange();
  const prev = previousMonthRange();
  const [current, previous] = await Promise.all([
    getTransactions({ from, to }),
    getTransactions({ from: prev.from, to: prev.to }),
  ]);
  return {
    currentMonthCashFlowCents: calculateMonthlyCashFlow(current),
    previousMonthCashFlowCents: previous.length > 0 ? calculateMonthlyCashFlow(previous) : null,
  };
}

export async function getBudgetStatus(): Promise<BudgetStatusTool> {
  const summary = await getBudgetSummary();
  if (!summary) return { hasBudget: false };

  const overBudgetCategories = summary.byCategory
    .filter((c) => c.status === "over_budget")
    .map((c) => {
      const category = summary.categories.find((bc) => bc.category_id === c.categoryId)?.category;
      return {
        name: category?.name_th ?? category?.name_en ?? "—",
        spentCents: c.spentCents,
        budgetCents: c.budgetCents,
      };
    });

  return {
    hasBudget: true,
    totalBudgetCents: summary.overall.budgetCents,
    spentCents: summary.overall.spentCents,
    remainingCents: summary.overall.remainingCents,
    percentUsed: summary.overall.percentUsed,
    status: summary.overall.status,
    overBudgetCategories,
  };
}

export async function getNetWorthSummary(): Promise<NetWorthTool> {
  const [breakdown, snapshots] = await Promise.all([getNetWorthBreakdown(), getNetWorthSnapshots(2)]);
  const previous = snapshots.length >= 2 ? parseMoneyToCents(snapshots[snapshots.length - 2].net_worth) : null;
  return {
    netWorthCents: breakdown.netWorthCents,
    totalAssetsCents: breakdown.totalAssetsCents,
    totalLiabilitiesCents: breakdown.totalLiabilitiesCents,
    changeVsPreviousCents: previous !== null ? breakdown.netWorthCents - previous : null,
  };
}

export async function getGoalProgress(): Promise<GoalProgressTool> {
  const goals = await getGoals();
  return {
    goals: goals.map((g) => {
      const currentCents = parseMoneyToCents(g.current_amount);
      const targetCents = parseMoneyToCents(g.target_amount);
      const targetDate = g.target_date ? new Date(g.target_date) : null;
      const monthlyCents = parseMoneyToCents(g.monthly_contribution);
      return {
        name: g.name,
        type: g.goal_type,
        progressPercent: calculateGoalProgress(currentCents, targetCents),
        remainingCents: calculateAmountRemaining(currentCents, targetCents),
        requiredMonthlyContributionCents: calculateRequiredMonthlyContribution(currentCents, targetCents, targetDate),
        scheduleStatus: calculateGoalScheduleStatus(currentCents, targetCents, targetDate, monthlyCents),
      };
    }),
  };
}

export async function getEmergencyFundStatus(): Promise<EmergencyFundTool> {
  const [fund, essential] = await Promise.all([getEmergencyFund(), getEssentialMonthlyExpenses()]);
  if (!fund) return { isSetUp: false };

  const currentAmountCents = parseMoneyToCents(fund.current_amount);
  const targetMonths = fund.target_months ? Number(fund.target_months) : 6;
  const targetAmountCents = calculateEmergencyFundTarget(
    essential.cents,
    fund.target_months ? Number(fund.target_months) : null,
    fund.custom_target_amount ? parseMoneyToCents(fund.custom_target_amount) : null
  );

  return {
    isSetUp: true,
    currentAmountCents,
    targetAmountCents,
    monthsProtected: calculateMonthsProtected(currentAmountCents, essential.cents),
    targetMonths,
  };
}

export async function getSafeToSpendSummary(): Promise<SafeToSpendTool> {
  const result = await getSafeToSpend();
  if (!result.hasCompleteData || !result.result) return { hasCompleteData: false };
  return {
    hasCompleteData: true,
    todayCents: result.result.todayCents,
    thisWeekCents: result.result.thisWeekCents,
    thisMonthCents: result.result.thisMonthCents,
  };
}

export async function getWealthScoreSummary(): Promise<WealthScoreTool | null> {
  const score = await getLatestStoredWealthScore();
  if (!score) return null;
  return {
    totalScore: Number(score.total_score),
    components: {
      cashFlow: Number(score.cash_flow_score),
      savings: Number(score.savings_score),
      emergencyFund: Number(score.emergency_fund_score),
      debtHealth: Number(score.debt_health_score),
      netWorthGrowth: Number(score.net_worth_growth_score),
      incomeGrowth: Number(score.income_growth_score),
      goalProgress: Number(score.goal_progress_score),
    },
  };
}

export async function getDebtSummary(): Promise<DebtSummaryTool> {
  const liabilities = await getLiabilities();
  const included = liabilities.filter((l) => l.include_in_net_worth);
  if (included.length === 0) return { hasDebt: false };
  return {
    hasDebt: true,
    totalDebtCents: included.reduce((sum, l) => sum + parseMoneyToCents(l.balance), 0),
    liabilities: included.map((l) => ({
      name: l.name,
      balanceCents: parseMoneyToCents(l.balance),
      interestRatePercent: l.interest_rate ? Number(l.interest_rate) : null,
    })),
  };
}

export async function getDebtPlan(): Promise<DebtPlanTool> {
  const summary = await getDebtPlannerSummary();
  if (summary.liabilities.length === 0) return { hasPlan: false };
  return {
    hasPlan: true,
    strategy: summary.plan?.strategy ?? "avalanche",
    monthsToDebtFree: summary.result.totalMonths,
    totalInterestPaidCents: summary.result.totalInterestPaidCents,
    interestSavedCents: summary.result.totalInterestSavedCents,
  };
}

export async function getForecastSummary(): Promise<ForecastSummaryTool> {
  const scenarios = await getForecastScenarios();
  if (scenarios.length === 0) return { hasScenario: false };

  const scenario = scenarios.find((s) => s.scenario_type === "base") ?? scenarios[0];
  const startingState = await getForecastStartingState();
  const assumptions = scenarioRowToAssumptions(scenario);
  const results = calculateForecast(startingState, assumptions, scenario.horizon_months);
  const final = results[results.length - 1];

  return {
    hasScenario: true,
    scenarioName: scenario.name,
    horizonMonths: scenario.horizon_months,
    projectedNetWorthCents: final?.netWorthCents,
  };
}

export async function getMoneyYearProgress(): Promise<MoneyYearProgressTool> {
  const summary = await getMoneyYearSummary(new Date().getFullYear());
  if (!summary) return { hasPlan: false };
  return {
    hasPlan: true,
    year: summary.moneyYear.year,
    metrics: summary.metrics.map((m) => ({
      key: m.key,
      actualCents: m.progress.actualCents,
      targetCents: m.progress.targetCents,
      status: m.status,
    })),
  };
}

export async function getFinancialLifeStage(): Promise<LifeStageTool> {
  const { lifeStage } = await getLifeStageAndPriorities();
  return { stage: lifeStage.stage, nextStage: lifeStage.nextStage };
}

export async function getFinancialPriority(): Promise<PriorityTool | null> {
  const { topPriority } = await getLifeStageAndPriorities();
  if (!topPriority) return null;
  return {
    priorityType: topPriority.priorityType,
    severity: topPriority.severity,
    amountCents: topPriority.amountCents,
    targetPercent: topPriority.targetPercent,
    goalName: topPriority.goalName,
    targetValue: topPriority.targetValue,
  };
}

/** Summary only — count + top spending categories. Never the full transaction list/dates/merchant names, per the task's "minimize token usage and unnecessary sensitive-data exposure" rule. */
export async function getRecentTransactionsSummary(): Promise<RecentTransactionsSummaryTool> {
  const [transactions, categories] = await Promise.all([getTransactions({ limit: 30 }), getCategories()]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const totalsByCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const category = t.category_id ? categoryById.get(t.category_id) : undefined;
    const name = category?.name_th ?? "อื่นๆ";
    totalsByCategory.set(name, (totalsByCategory.get(name) ?? 0) + parseMoneyToCents(t.amount));
  }

  const topCategories = Array.from(totalsByCategory.entries())
    .map(([name, totalCents]) => ({ name, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 5);

  return { count: transactions.length, topCategories };
}

export async function getIncomeSummary(): Promise<IncomeSummaryTool> {
  const { from, to } = getCurrentMonthRange();
  const prev = previousMonthRange();
  const [current, previous] = await Promise.all([
    getTransactions({ from, to }),
    getTransactions({ from: prev.from, to: prev.to }),
  ]);
  const currentMonthIncomeCents = calculateIncome(current);
  const previousMonthIncomeCents = previous.length > 0 ? calculateIncome(previous) : null;
  const growthPercent =
    previousMonthIncomeCents !== null && previousMonthIncomeCents > 0
      ? ((currentMonthIncomeCents - previousMonthIncomeCents) / previousMonthIncomeCents) * 100
      : null;

  return { currentMonthIncomeCents, previousMonthIncomeCents, growthPercent };
}

// Re-exported for the Monthly Health Check builder, which needs a couple of
// the same raw pieces (current/previous month transactions) without
// duplicating the date-range logic a third time.
export { calculateExpenses, calculateIncome };
