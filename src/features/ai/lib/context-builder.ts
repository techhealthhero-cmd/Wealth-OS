import "server-only";

import { getProfile } from "@/features/profile/queries";
import { getLocale } from "@/i18n/server";
import {
  getActiveIncomeMissions,
  getActiveWealthMissionsTool,
  getBudgetStatus,
  getDebtSummary,
  getDetectedSubscriptionsTool,
  getEmergencyFundStatus,
  getFinancialLifeStage,
  getFinancialPriority,
  getFinancialSummary,
  getGoalProgress,
  getIncomeGap,
  getIncomeProfile,
  getIncomeSummary,
  getMonthlyCashFlow,
  getMonthlyReviewStatusTool,
  getNetWorthSummary,
  getRecentTransactionsSummary,
  getSafeToSpendSummary,
  getSkillProfile,
  getTopIncomeOpportunities,
  getUpcomingBillsTool,
  getUserProgressTool,
  getWealthScoreSummary,
} from "@/features/ai/tools";
import type { FinancialContext } from "@/features/ai/types";

/**
 * Builds the compact snapshot sent with every chat turn. Deliberately calls
 * only the tools cheap enough to run on every message (no full transaction
 * history, no forecast simulation, no money-year breakdown) — those stay
 * available as on-demand tools for when a question genuinely needs them,
 * per the task's "minimize token usage" requirement.
 */
export async function buildFinancialContext(): Promise<FinancialContext> {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);

  const [
    snapshot,
    cashFlow,
    safeToSpend,
    budget,
    netWorth,
    emergencyFund,
    debts,
    goals,
    wealthScore,
    lifeStage,
    currentPriority,
    recentSpending,
    income,
    incomeProfile,
    incomeGap,
    skills,
    topOpportunities,
    activeMissions,
    activeWealthMissions,
    upcomingBills,
    detectedSubscriptions,
    monthlyReviewStatus,
    userProgress,
  ] = await Promise.all([
    getFinancialSummary(),
    getMonthlyCashFlow(),
    getSafeToSpendSummary(),
    getBudgetStatus(),
    getNetWorthSummary(),
    getEmergencyFundStatus(),
    getDebtSummary(),
    getGoalProgress(),
    getWealthScoreSummary(),
    getFinancialLifeStage(),
    getFinancialPriority(),
    getRecentTransactionsSummary(),
    getIncomeSummary(),
    getIncomeProfile(),
    getIncomeGap(),
    getSkillProfile(),
    getTopIncomeOpportunities(),
    getActiveIncomeMissions(),
    getActiveWealthMissionsTool(),
    getUpcomingBillsTool(),
    getDetectedSubscriptionsTool(),
    getMonthlyReviewStatusTool(),
    getUserProgressTool(),
  ]);

  return {
    locale,
    currencyCode: profile?.currency_code ?? "THB",
    snapshot,
    cashFlow,
    safeToSpend,
    budget,
    netWorth,
    emergencyFund,
    debts,
    goals,
    wealthScore,
    lifeStage,
    currentPriority,
    recentSpending,
    income,
    incomeProfile,
    incomeGap,
    skills,
    topOpportunities,
    activeMissions,
    activeWealthMissions,
    upcomingBills,
    detectedSubscriptions,
    monthlyReviewStatus,
    userProgress,
  };
}
