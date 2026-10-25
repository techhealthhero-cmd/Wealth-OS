/**
 * Numbers behind the Home yearly card's left-over-per-month bars for this
 * year. Pure functions over integer cents; no LLM involved. (The month-vs-
 * last-month category comparison was removed 2026-10-26 when the card went
 * fully yearly.)
 */

import {
  calculateExpenses,
  calculateIncome,
  type FinancialTransaction,
} from "./calculations";

export interface DatedFinancialTransaction extends FinancialTransaction {
  /** "YYYY-MM-DD" */
  transaction_date: string;
}

export type MonthlyNetState = "data" | "empty" | "future";

export interface MonthlyNetPoint {
  /** 0 = January. */
  monthIndex: number;
  incomeCents: number;
  expensesCents: number;
  /** Income − expenses. */
  netCents: number;
  /** "empty" = a past/current month with no income or expense at all; "future" = not reached yet. */
  state: MonthlyNetState;
  isCurrentMonth: boolean;
}

/**
 * One point per calendar month of `year` (always 12). A month with no
 * income/expense rows is "empty" rather than a ฿0 month, so a user who
 * started logging in September doesn't see eight fake break-even months.
 */
export function calculateMonthlyNetSeries(
  transactions: DatedFinancialTransaction[],
  year: number,
  currentMonthIndex: number
): MonthlyNetPoint[] {
  const byMonth = new Map<number, DatedFinancialTransaction[]>();
  const yearPrefix = `${year}-`;
  for (const t of transactions) {
    if (!t.transaction_date.startsWith(yearPrefix)) continue;
    const monthIndex = Number(t.transaction_date.slice(5, 7)) - 1;
    const bucket = byMonth.get(monthIndex);
    if (bucket) bucket.push(t);
    else byMonth.set(monthIndex, [t]);
  }

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthTransactions = byMonth.get(monthIndex) ?? [];
    const incomeCents = calculateIncome(monthTransactions);
    const expensesCents = calculateExpenses(monthTransactions);
    const hasData = monthTransactions.some((t) => t.type === "income" || t.type === "expense");
    const state: MonthlyNetState = monthIndex > currentMonthIndex ? "future" : hasData ? "data" : "empty";
    return {
      monthIndex,
      incomeCents,
      expensesCents,
      netCents: incomeCents - expensesCents,
      state,
      isCurrentMonth: monthIndex === currentMonthIndex,
    };
  });
}
