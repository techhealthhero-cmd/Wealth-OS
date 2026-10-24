/**
 * Numbers behind the Home yearly card's "View details" (2026-10-25):
 * the left-over-per-month bars for this year, and this month's spending by
 * category compared with the same days of last month. Pure functions over
 * integer cents; no LLM involved.
 */

import {
  calculateExpenses,
  calculateIncome,
  type CategorySpending,
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

/**
 * Last day of the previous month to compare against "this month so far":
 * day 24 of October compares with 1–24 September. Clamped to the previous
 * month's length (31 March compares with 1–28/29 February).
 * Returns "YYYY-MM-DD".
 */
export function samePeriodPreviousMonthEnd(today: Date): string {
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInPrevious = new Date(year, month, 0).getDate();
  const end = new Date(year, month - 1, Math.min(today.getDate(), daysInPrevious));
  const mm = String(end.getMonth() + 1).padStart(2, "0");
  const dd = String(end.getDate()).padStart(2, "0");
  return `${end.getFullYear()}-${mm}-${dd}`;
}

export type CategoryChange = "more" | "less" | "same" | "new";

export interface CategoryComparisonRow {
  categoryId: string | null;
  totalCents: number;
  /** Share of this month's total spending, 0–100. */
  sharePercent: number;
  previousCents: number;
  /** totalCents − previousCents. */
  deltaCents: number;
  change: CategoryChange;
}

function changeFor(totalCents: number, previousCents: number): CategoryChange {
  if (previousCents === 0) return "new";
  if (totalCents > previousCents) return "more";
  if (totalCents < previousCents) return "less";
  return "same";
}

/**
 * This month's categories (already sorted, largest first) with what the
 * same category cost over the comparison period. Categories spent on only
 * last month are not listed — the list answers "where did my money go
 * this month?".
 */
export function compareCategorySpending(
  current: CategorySpending[],
  previous: CategorySpending[]
): CategoryComparisonRow[] {
  const previousById = new Map(previous.map((entry) => [entry.categoryId, entry.totalCents]));
  const total = current.reduce((sum, entry) => sum + entry.totalCents, 0);

  return current.map((entry) => {
    const previousCents = previousById.get(entry.categoryId) ?? 0;
    return {
      categoryId: entry.categoryId,
      totalCents: entry.totalCents,
      sharePercent: total > 0 ? (entry.totalCents / total) * 100 : 0,
      previousCents,
      deltaCents: entry.totalCents - previousCents,
      change: changeFor(entry.totalCents, previousCents),
    };
  });
}

export interface GroupedCategoryRows<T extends CategoryComparisonRow = CategoryComparisonRow> {
  top: T[];
  /** Everything past `maxRows`, summed; null when nothing was folded. */
  rest: (Omit<CategoryComparisonRow, "categoryId"> & { count: number }) | null;
}

/**
 * Keeps the first `maxRows` rows and folds the remainder into one "Other (N)"
 * row — but never folds a single row: "Other (1 category)" says less than
 * the category's own name.
 */
export function groupTopCategories<T extends CategoryComparisonRow>(rows: T[], maxRows: number): GroupedCategoryRows<T> {
  if (rows.length <= maxRows + 1) return { top: rows, rest: null };
  const folded = rows.slice(maxRows);
  const totalCents = folded.reduce((sum, row) => sum + row.totalCents, 0);
  const previousCents = folded.reduce((sum, row) => sum + row.previousCents, 0);
  return {
    top: rows.slice(0, maxRows),
    rest: {
      count: folded.length,
      totalCents,
      sharePercent: folded.reduce((sum, row) => sum + row.sharePercent, 0),
      previousCents,
      deltaCents: totalCents - previousCents,
      change: changeFor(totalCents, previousCents),
    },
  };
}
