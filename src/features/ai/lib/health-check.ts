import "server-only";

/**
 * Monthly Financial Health Check — fully deterministic. Every number comes
 * from real current/previous-month data; the AI (if asked) may only narrate
 * this structure, never recompute or override it.
 */

import { getTransactions, getCurrentMonthRange, type TransactionWithRelations } from "@/features/transactions/queries";
import {
  calculateDebtReductionContributions,
  calculateExpenses,
  calculateIncome,
  calculateMonthlyCashFlow,
  calculateSavingsRate,
} from "@/lib/financial/calculations";
import { getBudgetStatus, getFinancialPriority, getNetWorthSummary } from "@/features/ai/tools";
import type { BudgetStatusTool, NetWorthTool, PriorityTool } from "@/features/ai/types";
import { toLocalDateString } from "@/lib/date";

export type HealthCheckItemType =
  | "income_up"
  | "income_down"
  | "expenses_up"
  | "expenses_down"
  | "savings_rate_up"
  | "savings_rate_down"
  | "cash_flow_negative"
  | "cash_flow_recovered"
  | "budget_over"
  | "debt_paid_down"
  | "net_worth_up"
  | "net_worth_down";

/** Neutral month-over-month deltas — reported regardless of threshold, with no good/bad framing (that judgment lives in `positives`/`risks` instead). */
export type HealthCheckChangeType =
  | "income_change"
  | "expenses_change"
  | "savings_rate_change"
  | "cash_flow_change"
  | "net_worth_change";

export interface HealthCheckItem {
  type: HealthCheckItemType;
  amountCents?: number;
  percent?: number;
}

export interface HealthCheckChange {
  type: HealthCheckChangeType;
  amountCents?: number;
  percent?: number;
}

export type HealthCheckStatus = "good" | "mixed" | "needs_attention";

export interface MonthlyHealthCheck {
  hasEnoughData: boolean;
  overallStatus: HealthCheckStatus;
  positives: HealthCheckItem[];
  risks: HealthCheckItem[];
  changes: HealthCheckChange[];
  priorityAction: PriorityTool | null;
}

function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

const INCOME_CHANGE_THRESHOLD_PERCENT = 5;
const EXPENSE_CHANGE_THRESHOLD_PERCENT = 10;
const SAVINGS_RATE_CHANGE_THRESHOLD_POINTS = 5;

export interface HealthCheckInputs {
  currentTx: TransactionWithRelations[];
  prevTx: TransactionWithRelations[];
  budget: BudgetStatusTool;
  netWorth: NetWorthTool;
  priorityAction: PriorityTool | null;
}

/**
 * The pure diff/scoring core, split out from buildMonthlyHealthCheck()
 * below so the proactive AI check-in cron job (health-check-for-user.ts)
 * can reuse the exact same math against data it fetches its own way (an
 * explicit userId + service-role client, since a cron job has no session
 * to read via the usual request-scoped createClient()) — never a second,
 * drifting copy of this logic. Zero behavior change for the existing
 * interactive path; buildMonthlyHealthCheck() is now just this plus the
 * session-scoped fetch.
 */
export function computeMonthlyHealthCheck(inputs: HealthCheckInputs): MonthlyHealthCheck {
  const { currentTx, prevTx, budget, netWorth, priorityAction } = inputs;

  if (prevTx.length === 0) {
    // Not enough history for a month-over-month comparison yet — an honest
    // "not ready" state, not a fabricated "everything's fine".
    return { hasEnoughData: false, overallStatus: "mixed", positives: [], risks: [], changes: [], priorityAction };
  }

  const positives: HealthCheckItem[] = [];
  const risks: HealthCheckItem[] = [];
  const changes: HealthCheckChange[] = [];

  const currentIncome = calculateIncome(currentTx);
  const prevIncome = calculateIncome(prevTx);
  if (prevIncome > 0) {
    const incomeChangePercent = ((currentIncome - prevIncome) / prevIncome) * 100;
    changes.push({ type: "income_change", percent: incomeChangePercent });
    if (incomeChangePercent >= INCOME_CHANGE_THRESHOLD_PERCENT) {
      positives.push({ type: "income_up", percent: incomeChangePercent });
    } else if (incomeChangePercent <= -INCOME_CHANGE_THRESHOLD_PERCENT) {
      risks.push({ type: "income_down", percent: incomeChangePercent });
    }
  }

  const currentExpenses = calculateExpenses(currentTx);
  const prevExpenses = calculateExpenses(prevTx);
  if (prevExpenses > 0) {
    const expenseChangePercent = ((currentExpenses - prevExpenses) / prevExpenses) * 100;
    changes.push({ type: "expenses_change", percent: expenseChangePercent });
    if (expenseChangePercent >= EXPENSE_CHANGE_THRESHOLD_PERCENT) {
      risks.push({ type: "expenses_up", percent: expenseChangePercent });
    } else if (expenseChangePercent <= -EXPENSE_CHANGE_THRESHOLD_PERCENT) {
      positives.push({ type: "expenses_down", percent: expenseChangePercent });
    }
  }

  const currentSavingsRate = calculateSavingsRate(currentTx);
  const prevSavingsRate = calculateSavingsRate(prevTx);
  const savingsRateDelta = currentSavingsRate - prevSavingsRate;
  changes.push({ type: "savings_rate_change", percent: savingsRateDelta });
  if (savingsRateDelta >= SAVINGS_RATE_CHANGE_THRESHOLD_POINTS) {
    positives.push({ type: "savings_rate_up", percent: savingsRateDelta });
  } else if (savingsRateDelta <= -SAVINGS_RATE_CHANGE_THRESHOLD_POINTS) {
    risks.push({ type: "savings_rate_down", percent: savingsRateDelta });
  }

  const currentCashFlow = calculateMonthlyCashFlow(currentTx);
  const prevCashFlow = calculateMonthlyCashFlow(prevTx);
  changes.push({ type: "cash_flow_change", amountCents: currentCashFlow - prevCashFlow });
  if (currentCashFlow < 0) {
    risks.push({ type: "cash_flow_negative", amountCents: currentCashFlow });
  } else if (prevCashFlow < 0 && currentCashFlow >= 0) {
    positives.push({ type: "cash_flow_recovered" });
  }

  if (budget.hasBudget && budget.status === "over_budget") {
    risks.push({ type: "budget_over", amountCents: budget.remainingCents });
  }

  const debtPaidCents = calculateDebtReductionContributions(currentTx);
  if (debtPaidCents > 0) {
    positives.push({ type: "debt_paid_down", amountCents: debtPaidCents });
  }

  if (netWorth.changeVsPreviousCents !== null) {
    changes.push({ type: "net_worth_change", amountCents: netWorth.changeVsPreviousCents });
    if (netWorth.changeVsPreviousCents > 0) {
      positives.push({ type: "net_worth_up", amountCents: netWorth.changeVsPreviousCents });
    } else if (netWorth.changeVsPreviousCents < 0) {
      risks.push({ type: "net_worth_down", amountCents: netWorth.changeVsPreviousCents });
    }
  }

  const hasCriticalRisk = risks.some((r) => r.type === "cash_flow_negative" || r.type === "budget_over");
  let overallStatus: HealthCheckStatus;
  if (hasCriticalRisk) {
    overallStatus = "needs_attention";
  } else if (positives.length > risks.length) {
    overallStatus = "good";
  } else if (risks.length === 0) {
    overallStatus = "good";
  } else {
    overallStatus = "mixed";
  }

  return { hasEnoughData: true, overallStatus, positives, risks, changes, priorityAction };
}

/** Session-scoped fetch + compute, for the interactive AI page (unchanged behavior from before the computeMonthlyHealthCheck() split above). */
export async function buildMonthlyHealthCheck(): Promise<MonthlyHealthCheck> {
  const { from, to } = getCurrentMonthRange();
  const prev = previousMonthRange();

  const [currentTx, prevTx, budget, netWorth, priorityAction] = await Promise.all([
    getTransactions({ from, to }),
    getTransactions({ from: prev.from, to: prev.to }),
    getBudgetStatus(),
    getNetWorthSummary(),
    getFinancialPriority(),
  ]);

  return computeMonthlyHealthCheck({ currentTx, prevTx, budget, netWorth, priorityAction });
}
