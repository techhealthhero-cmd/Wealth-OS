import "server-only";

import { getAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getCurrentMonthRange, getTransactions } from "@/features/transactions/queries";
import {
  calculateIncome,
  calculateExpenses,
  calculateMonthlyCashFlow,
  calculateSavingsRate,
  calculateSpendingByCategory,
} from "@/lib/financial/calculations";

export async function getDashboardData() {
  const { from, to } = getCurrentMonthRange();

  const [monthTransactions, recentTransactions, accounts, categories] = await Promise.all([
    getTransactions({ from, to }),
    getTransactions({ limit: 5 }),
    getAccounts(),
    getCategories(),
  ]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return {
    incomeCents: calculateIncome(monthTransactions),
    expensesCents: calculateExpenses(monthTransactions),
    cashFlowCents: calculateMonthlyCashFlow(monthTransactions),
    savingsRatePercent: calculateSavingsRate(monthTransactions),
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
}
