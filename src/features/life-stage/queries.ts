import "server-only";

import { getTransactions, getCurrentMonthRange } from "@/features/transactions/queries";
import { getLiabilities } from "@/features/liabilities/queries";
import { getGoals } from "@/features/goals/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getNetWorthBreakdown } from "@/features/net-worth/queries";
import {
  calculateExpenses,
  calculateIncome,
  calculateInvestmentContributions,
  calculateMonthlyCashFlow,
  calculateSavingsRate,
} from "@/lib/financial/calculations";
import { calculateMonthsProtected } from "@/lib/financial/emergency-fund";
import { calculateGoalProgress, calculateGoalScheduleStatus, calculateRequiredMonthlyContribution } from "@/lib/financial/goals";
import {
  calculateFinancialLifeStage,
  HIGH_INTEREST_RATE_THRESHOLD_PERCENT,
  type LifeStageResult,
} from "@/lib/financial/life-stage";
import { getFinancialPriorities, type FinancialPriority } from "@/lib/financial/priority-engine";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import { getIncomeProfileSummary } from "@/features/income-profile/queries";
import { getIncomeTarget } from "@/features/income-target/queries";
import { calculateIncomeGap } from "@/lib/financial/income-gap";

function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

export interface LifeStageAndPriorities {
  lifeStage: LifeStageResult;
  topPriority: FinancialPriority | null;
}

/**
 * Both Financial Life Stage and the Priority Engine are computed live from
 * existing Day 1/2 data — neither has its own table (see
 * 0004_financial_planning.sql's header for why). Deliberately does NOT
 * depend on any Day 3 table, so it works the moment migration 0003 is live,
 * independent of 0004.
 */
export async function getLifeStageAndPriorities(): Promise<LifeStageAndPriorities> {
  const { from: currentFrom, to: currentTo } = getCurrentMonthRange();
  const { from: prevFrom, to: prevTo } = previousMonthRange();

  const [currentMonthTx, prevMonthTx, liabilities, goals, emergencyFund, essential, netWorth, incomeProfileSummary, incomeTarget] =
    await Promise.all([
      getTransactions({ from: currentFrom, to: currentTo }),
      getTransactions({ from: prevFrom, to: prevTo }),
      getLiabilities(),
      getGoals(),
      getEmergencyFund(),
      getEssentialMonthlyExpenses(),
      getNetWorthBreakdown(),
      getIncomeProfileSummary(),
      getIncomeTarget(),
    ]);

  const cashFlowCents = calculateMonthlyCashFlow(currentMonthTx);
  const incomeCents = calculateIncome(currentMonthTx);
  const prevIncomeCents = prevMonthTx.length > 0 ? calculateIncome(prevMonthTx) : null;
  const savingsRatePercent = calculateSavingsRate(currentMonthTx);
  const monthlyExpensesCents = calculateExpenses(currentMonthTx);

  const emergencyFundCurrentCents = emergencyFund ? parseMoneyToCents(emergencyFund.current_amount) : 0;
  const emergencyFundMonthsProtected = calculateMonthsProtected(emergencyFundCurrentCents, essential.cents);
  const emergencyFundTargetMonths = emergencyFund?.target_months ? Number(emergencyFund.target_months) : 6;

  const includedLiabilities = liabilities.filter((l) => l.include_in_net_worth);
  const highInterestLiabilities = includedLiabilities
    .filter((l) => l.interest_rate !== null && Number(l.interest_rate) >= HIGH_INTEREST_RATE_THRESHOLD_PERCENT)
    .map((l) => ({ name: l.name, balanceCents: parseMoneyToCents(l.balance), interestRatePercent: Number(l.interest_rate) }));

  const hasInvestmentActivity = calculateInvestmentContributions(currentMonthTx) > 0 || calculateInvestmentContributions(prevMonthTx) > 0;

  const activeGoals = goals.filter((g) => g.status === "active");
  const behindGoals = activeGoals
    .map((g) => {
      const currentCents = parseMoneyToCents(g.current_amount);
      const targetCents = parseMoneyToCents(g.target_amount);
      const targetDate = g.target_date ? new Date(g.target_date) : null;
      const monthlyCents = parseMoneyToCents(g.monthly_contribution);
      const status = calculateGoalScheduleStatus(currentCents, targetCents, targetDate, monthlyCents);
      return {
        name: g.name,
        status,
        requiredMonthlyContributionCents: calculateRequiredMonthlyContribution(currentCents, targetCents, targetDate),
        progressPercent: calculateGoalProgress(currentCents, targetCents),
      };
    })
    .filter((g) => g.status === "behind");

  const incomeGrowthPercent = prevIncomeCents !== null && prevIncomeCents > 0 ? ((incomeCents - prevIncomeCents) / prevIncomeCents) * 100 : null;

  // Day 5 Income Engine — only affects priority ranking once the user has
  // explicitly set a target (see priority-engine.ts's income_gap branch).
  const incomeGap = calculateIncomeGap({
    targetMonthlyIncomeCents:
      incomeTarget?.target_monthly_income !== null && incomeTarget?.target_monthly_income !== undefined
        ? parseMoneyToCents(incomeTarget.target_monthly_income)
        : null,
    averageMonthlyIncomeCents: incomeProfileSummary.profile.averageMonthlyIncomeCents,
  });

  const lifeStage = calculateFinancialLifeStage({
    cashFlowCents,
    emergencyFundMonthsProtected,
    hasHighInterestDebt: highInterestLiabilities.length > 0,
    savingsRatePercent,
    hasInvestmentActivity,
    netWorthCents: netWorth.netWorthCents,
    annualExpensesCents: monthlyExpensesCents * 12,
  });

  const topPriority = getFinancialPriorities({
    cashFlowCents,
    emergencyFundMonthsProtected,
    emergencyFundTargetMonths,
    essentialMonthlyExpensesCents: essential.cents,
    emergencyFundCurrentCents,
    highInterestLiabilities,
    savingsRatePercent,
    hasInvestmentActivity,
    behindGoals,
    incomeGrowthPercent,
    incomeGapCents: incomeGap.hasTarget ? incomeGap.gapCents : null,
    incomeConcentrationPercent: incomeProfileSummary.profile.concentrationPercent,
  })[0] ?? null;

  return { lifeStage, topPriority };
}
