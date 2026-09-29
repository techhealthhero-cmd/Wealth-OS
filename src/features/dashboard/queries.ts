import "server-only";

import { getDisplayAccounts } from "@/features/accounts/queries";
import { redactAccountRelationsForPrivacy } from "@/features/account-privacy/account-redaction";
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
 * trend chart (net-worth-hero.tsx).
 *
 * One `getTransactions()` call per month (each hitting its own `.gte()`/
 * `.lte()` DB-level filter — the same reliable per-month range query
 * `getCurrentMonthRange()`/`getDashboardData()` already use), run in
 * parallel, rather than one bulk fetch for the whole window re-filtered by
 * comparing date strings in memory. The current month's call here uses the
 * exact same `{from, to}` pair `getDashboardData()` computes via
 * `getCurrentMonthRange()`, so it hits the same request-scoped
 * `fetchTransactionsCached()` entry — this chart and the current month's
 * other dashboard figures can no longer disagree about what "this month"
 * contains. Always includes exactly 6 points, even for a month with zero
 * transactions, so the trend line never silently skips a quiet month.
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

    return Promise.all(
      months.map(async ({ monthDate, monthFrom, monthTo }) => {
        const monthTransactions = await getTransactions({ from: monthFrom, to: monthTo });
        return {
          monthKey: monthFrom.slice(0, 7),
          monthDate,
          incomeCents: calculateIncome(monthTransactions),
          expensesCents: calculateExpenses(monthTransactions),
        };
      })
    );
  });
}

export function getDashboardData() {
  return withPerfLog("getDashboardData", async () => {
  const { from, to } = getCurrentMonthRange();
  const { from: prevFrom, to: prevTo } = getPreviousMonthRange();

  const [monthTransactions, prevMonthTransactions, recentTransactions, accounts, categories] = await Promise.all([
    getTransactions({ from, to }),
    getTransactions({ from: prevFrom, to: prevTo }),
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
    recentTransactions: redactAccountRelationsForPrivacy(recentTransactions, accounts),
    hasAnyData: accounts.length > 0 || monthTransactions.length > 0,
  };
  });
}
