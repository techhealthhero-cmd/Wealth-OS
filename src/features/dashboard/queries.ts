import "server-only";

import { getAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getCurrentMonthRange, getTransactions } from "@/features/transactions/queries";
import { toLocalDateString } from "@/lib/date";
import { withPerfLog } from "@/lib/dev-diagnostics";
import {
  calculateChangePercent,
  calculateIncome,
  calculateExpenses,
  calculateMonthlyCashFlow,
  calculateSavingsRate,
  calculateSpendingByCategory,
} from "@/lib/financial/calculations";

/** Mirrors the local `previousMonthRange()` helper already used the same way in life-stage/queries.ts. */
function getPreviousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

export interface MonthlyIncomeExpensePoint {
  /** "YYYY-MM" — a stable sort/dedupe key, formatted for display by the caller (locale-aware). */
  monthKey: string;
  monthDate: Date;
  incomeCents: number;
  expensesCents: number;
}

const INCOME_EXPENSE_TREND_MONTHS = 6;

/**
 * Last 6 calendar months of income/expense, one point per month — matches
 * the existing "last 6 months" convention already used for the net worth
 * trend chart (net-worth-hero.tsx). One `transactions` query for the whole
 * window, then bucketed by month in memory (the same "fetch once, filter
 * per-bucket" pattern used for money-year's quarterly summaries) rather
 * than a separate query per month — always includes exactly 6 points, even
 * for a month with zero transactions, so the trend line never silently
 * skips a quiet month.
 */
export function getIncomeExpenseTrend() {
  return withPerfLog("getIncomeExpenseTrend", async (): Promise<MonthlyIncomeExpensePoint[]> => {
    const now = new Date();
    const from = toLocalDateString(new Date(now.getFullYear(), now.getMonth() - (INCOME_EXPENSE_TREND_MONTHS - 1), 1));
    const to = toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const transactions = await getTransactions({ from, to });

    const points: MonthlyIncomeExpensePoint[] = [];
    for (let i = INCOME_EXPENSE_TREND_MONTHS - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthFrom = toLocalDateString(monthDate);
      const monthTo = toLocalDateString(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
      const monthTransactions = transactions.filter(
        (t) => t.transaction_date >= monthFrom && t.transaction_date <= monthTo
      );
      points.push({
        monthKey: monthFrom.slice(0, 7),
        monthDate,
        incomeCents: calculateIncome(monthTransactions),
        expensesCents: calculateExpenses(monthTransactions),
      });
    }
    return points;
  });
}

export type IncomeExpensePeriod = "week" | "month" | "year";

export interface IncomeExpenseOverviewPoint {
  /** "YYYY-MM-DD" — the start of the bucket, formatted for display by the (client) caller, locale- and period-aware. */
  periodStart: string;
  incomeCents: number;
  expensesCents: number;
}

const WEEK_POINTS = 8;
const MONTH_POINTS = 12;
const YEAR_POINTS = 5;

/** Monday-start week containing `date`, at local midnight. */
function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diffToMonday);
  return result;
}

/**
 * Backs the "เดือนนี้" card's replacement (a period-switchable Income vs
 * Expense trend, 2026-09 redesign) — week/month/year buckets, each always a
 * fixed point count (even a zero period stays in the series, same
 * no-silent-gaps rule as getIncomeExpenseTrend above), computed from one
 * shared "fetch once, bucket in memory" transactions query spanning the
 * widest window (the 5-year lookback) rather than three separate queries.
 */
export function getIncomeExpenseOverview() {
  return withPerfLog("getIncomeExpenseOverview", async (): Promise<Record<IncomeExpensePeriod, IncomeExpenseOverviewPoint[]>> => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now);

    const earliestStart = new Date(now.getFullYear() - (YEAR_POINTS - 1), 0, 1);
    const from = toLocalDateString(earliestStart);
    const to = toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const transactions = await getTransactions({ from, to });

    const bucket = (start: Date, end: Date): IncomeExpenseOverviewPoint => {
      const startStr = toLocalDateString(start);
      const endStr = toLocalDateString(end);
      const inRange = transactions.filter((t) => t.transaction_date >= startStr && t.transaction_date <= endStr);
      return {
        periodStart: startStr,
        incomeCents: calculateIncome(inRange),
        expensesCents: calculateExpenses(inRange),
      };
    };

    const week: IncomeExpenseOverviewPoint[] = [];
    for (let i = WEEK_POINTS - 1; i >= 0; i--) {
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() - 7 * i);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      week.push(bucket(start, end));
    }

    const month: IncomeExpenseOverviewPoint[] = [];
    for (let i = MONTH_POINTS - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      month.push(bucket(start, end));
    }

    const year: IncomeExpenseOverviewPoint[] = [];
    for (let i = YEAR_POINTS - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear() - i, 0, 1);
      const end = new Date(now.getFullYear() - i, 11, 31);
      year.push(bucket(start, end));
    }

    return { week, month, year };
  });
}

export function getDashboardData() {
  return withPerfLog("getDashboardData", async () => {
  const { from, to } = getCurrentMonthRange();
  const { from: prevFrom, to: prevTo } = getPreviousMonthRange();

  const [monthTransactions, prevMonthTransactions, recentTransactions, accounts, categories] = await Promise.all([
    getTransactions({ from, to }),
    getTransactions({ from: prevFrom, to: prevTo }),
    getTransactions({ limit: 5 }),
    getAccounts(),
    getCategories(),
  ]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const incomeCents = calculateIncome(monthTransactions);
  const expensesCents = calculateExpenses(monthTransactions);
  const cashFlowCents = calculateMonthlyCashFlow(monthTransactions);
  const savingsRatePercent = calculateSavingsRate(monthTransactions);

  const prevIncomeCents = calculateIncome(prevMonthTransactions);
  const prevExpensesCents = calculateExpenses(prevMonthTransactions);
  const prevCashFlowCents = calculateMonthlyCashFlow(prevMonthTransactions);
  const prevSavingsRatePercent = calculateSavingsRate(prevMonthTransactions);

  return {
    incomeCents,
    expensesCents,
    cashFlowCents,
    savingsRatePercent,
    hasMonthData: monthTransactions.length > 0,
    incomeChangePercent: calculateChangePercent(incomeCents, prevIncomeCents),
    expensesChangePercent: calculateChangePercent(expensesCents, prevExpensesCents),
    cashFlowChangePercent: calculateChangePercent(cashFlowCents, prevCashFlowCents),
    // Savings rate is already a percentage, so its "change" is a percentage-
    // point difference (e.g. 30% -> 35% is "+5pp"), never a percent-of-a-
    // percent via calculateChangePercent — that would read as a much larger,
    // misleading swing for the same underlying move.
    savingsRateChangePoints: prevMonthTransactions.length > 0 ? savingsRatePercent - prevSavingsRatePercent : null,
    spendingByCategory: calculateSpendingByCategory(monthTransactions).map((entry) => {
      const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;
      return {
        ...entry,
        categoryNameEn: category?.name_en ?? null,
        categoryNameTh: category?.name_th ?? null,
      };
    }),
    accounts,
    categories,
    recentTransactions,
    hasAnyData: accounts.length > 0 || monthTransactions.length > 0,
  };
  });
}
