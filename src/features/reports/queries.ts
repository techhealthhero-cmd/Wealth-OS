import "server-only";

import { getFinancialSummary } from "@/features/ai/tools";
import { getNetWorthBreakdown, type NetWorthBreakdown } from "@/features/net-worth/queries";
import { computeWealthScore, type WealthScoreComputation } from "@/features/wealth-score/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getGoals } from "@/features/goals/queries";
import { getMoneyYearSummary, type MoneyYearSummary } from "@/features/money-year/queries";
import type { FinancialSnapshotTool } from "@/features/ai/types";
import type { EmergencyFund, FinancialGoal } from "@/types/database";

export interface FinancialReportData {
  generatedAt: string;
  summary: FinancialSnapshotTool;
  netWorth: NetWorthBreakdown;
  wealthScore: WealthScoreComputation;
  emergencyFund: EmergencyFund | null;
  essentialMonthlyExpensesCents: number;
  goals: FinancialGoal[];
  /** null when the user hasn't set up a Money Year plan for the current year — the report still renders, just without this section. */
  moneyYear: MoneyYearSummary | null;
}

/**
 * Composes the Pro-only PDF financial report (FEATURES.PDF_REPORT) entirely
 * from data this app already computes elsewhere — same "pure core, thin
 * wrapper" rule as everywhere else (see CLAUDE.md "FINANCIAL LOGIC"): no new
 * calculation logic here, just gathering already-tested results for
 * pdf-report.tsx to lay out. Mirrors export.ts's role for the existing CSV
 * export (Pro-only, FEATURES.DATA_EXPORT) — a pure data-shaping step,
 * separate from the route handler's auth/gate/response concerns.
 */
export async function getFinancialReportData(): Promise<FinancialReportData> {
  const year = new Date().getFullYear();

  const [summary, netWorth, wealthScore, emergencyFund, essential, goals, moneyYear] = await Promise.all([
    getFinancialSummary(),
    getNetWorthBreakdown(),
    computeWealthScore(),
    getEmergencyFund(),
    getEssentialMonthlyExpenses(),
    getGoals(),
    getMoneyYearSummary(year),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    summary,
    netWorth,
    wealthScore,
    emergencyFund,
    essentialMonthlyExpensesCents: essential.cents,
    goals,
    moneyYear,
  };
}
