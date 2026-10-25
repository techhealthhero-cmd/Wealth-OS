import "server-only";

import { getDisplayAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getCurrentMonthRange, getFinancialTransactions, getTransactions } from "@/features/transactions/queries";
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
import { calculateMonthlyNetSeries } from "@/lib/financial/month-details";

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
 * trend chart (net-worth-hero.tsx).
 *
 * The whole window is fetched in one range query and bucketed in memory.
 * This replaces six PostgREST round trips with one while transferring the
 * same transaction rows. Always includes exactly 6 points, even for a
 * month with zero transactions, so the trend line never silently skips a
 * quiet month.
 */
export function getIncomeExpenseTrend() {
  return withPerfLog("getIncomeExpenseTrend", async (): Promise<MonthlyIncomeExpensePoint[]> => {
    const now = new Date();
    const months = Array.from({ length: INCOME_EXPENSE_TREND_MONTHS }, (_, idx) => {
      const i = INCOME_EXPENSE_TREND_MONTHS - 1 - idx;
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthFrom = toLocalDateString(monthDate);
      const monthTo = toLocalDateString(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
      return { monthDate, monthFrom, monthTo };
    });

    const transactions = await getFinancialTransactions({
      from: months[0].monthFrom,
      to: months[months.length - 1].monthTo,
    });
    const transactionsByMonth = new Map<string, typeof transactions>();

    for (const transaction of transactions) {
      const monthKey = transaction.transaction_date.slice(0, 7);
      const bucket = transactionsByMonth.get(monthKey);
      if (bucket) bucket.push(transaction);
      else transactionsByMonth.set(monthKey, [transaction]);
    }

    return months.map(({ monthDate, monthFrom }) => {
      const monthKey = monthFrom.slice(0, 7);
      const monthTransactions = transactionsByMonth.get(monthKey) ?? [];
      return {
        monthKey,
        monthDate,
        incomeCents: calculateIncome(monthTransactions),
        expensesCents: calculateExpenses(monthTransactions),
      };
    });
  });
}

export function getDashboardData() {
  return withPerfLog("getDashboardData", async () => {
  const { from, to } = getCurrentMonthRange();
  const { from: prevFrom, to: prevTo } = getPreviousMonthRange();
  // Year to date ends where "this month" ends, so the yearly total always
  // contains exactly the month total shown alongside it.
  const yearFrom = `${from.slice(0, 4)}-01-01`;

  const [monthTransactions, prevMonthTransactions, yearTransactions, recentTransactions, accounts, categories] = await Promise.all([
    getFinancialTransactions({ from, to }),
    getFinancialTransactions({ from: prevFrom, to: prevTo }),
    getFinancialTransactions({ from: yearFrom, to }),
    // 2026-09 Home redesign: recent transactions is now a 3-item preview
    // behind the "show more details" toggle (full history at
    // /money/transactions), not a 5-item list rendered by default.
    getTransactions({ limit: 3 }),
    getDisplayAccounts(),
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
    yearIncomeCents: calculateIncome(yearTransactions),
    yearExpensesCents: calculateExpenses(yearTransactions),
    yearSavingsRatePercent: calculateSavingsRate(yearTransactions),
    hasYearData: yearTransactions.length > 0,
    incomeChangePercent: calculateChangePercent(incomeCents, prevIncomeCents),
    expensesChangePercent: calculateChangePercent(expensesCents, prevExpensesCents),
    cashFlowChangePercent: calculateChangePercent(cashFlowCents, prevCashFlowCents),
    // Savings rate is already a percentage, so its "change" is a percentage-
    // point difference (e.g. 30% -> 35% is "+5pp"), never a percent-of-a-
    // percent via calculateChangePercent — that would read as a much larger,
    // misleading swing for the same underlying move.
    savingsRateChangePoints: prevMonthTransactions.length > 0 ? savingsRatePercent - prevSavingsRatePercent : null,
    // This year's left-over per month, for the yearly card's details.
    monthlyNet: calculateMonthlyNetSeries(yearTransactions, Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1),
    // This year's spending per category, largest first (the yearly card
    // lists every one — 2026-10-26).
    yearCategorySpending: calculateSpendingByCategory(yearTransactions).map((row) => {
      const category = row.categoryId ? categoryById.get(row.categoryId) : undefined;
      return {
        ...row,
        categoryNameEn: category?.name_en ?? null,
        categoryNameTh: category?.name_th ?? null,
        categoryIcon: category?.icon ?? null,
      };
    }),
    accounts,
    categories,
    recentTransactions,
    hasAnyData: accounts.length > 0 || monthTransactions.length > 0,
  };
  });
}
