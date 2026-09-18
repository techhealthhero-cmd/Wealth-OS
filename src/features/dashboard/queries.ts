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
