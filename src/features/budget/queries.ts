import "server-only";
import { cache } from "react";
import { throwDbError } from "@/lib/db-error";

import { createClient } from "@/lib/supabase/server";
import { getTransactions } from "@/features/transactions/queries";
import { calculateExpenses, calculateSpendingByCategory } from "@/lib/financial/calculations";
import { calculateBudgetStatus, calculateCategoryBudgetStatuses, daysInMonth } from "@/lib/financial/budget";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import type { Budget, BudgetCategory, Category } from "@/types/database";

export interface BudgetCategoryWithCategory extends BudgetCategory {
  category: Pick<Category, "id" | "name_th" | "name_en" | "icon"> | null;
}

export interface BudgetSummary {
  budget: Budget;
  categories: BudgetCategoryWithCategory[];
  overall: ReturnType<typeof calculateBudgetStatus>;
  byCategory: ReturnType<typeof calculateCategoryBudgetStatuses>;
}

/** Normalizes any date to the first of its month, as an ISO date string (matches the `budgets.month` column shape). */
export function toMonthKey(date: Date): string {
  return toLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1));
}

export async function getBudgetForMonth(monthKey: string): Promise<Budget | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("budgets").select("*").eq("month", monthKey).maybeSingle();
  if (error) throwDbError(error, "budget.getBudgetForMonth", "Failed to load budget");
  return data;
}

export async function getBudgetCategories(budgetId: string): Promise<BudgetCategoryWithCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budget_categories")
    .select("*, category:categories(id, name_th, name_en, icon)")
    .eq("budget_id", budgetId);

  if (error) throwDbError(error, "budget.getBudgetCategories", "Failed to load budget categories");
  return (data ?? []) as unknown as BudgetCategoryWithCategory[];
}

export async function getBudgets(): Promise<Budget[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("budgets").select("*").order("month", { ascending: false });
  if (error) throwDbError(error, "budget.getBudgets", "Failed to load budgets");
  return data ?? [];
}

/**
 * React `cache()` keys by argument identity — `monthDate: Date = new Date()`
 * would never dedupe on its own default (a fresh `Date` object every call,
 * even within the same millisecond). Keying the cached inner function by
 * the already-computed `monthKey` string (a primitive) is what actually
 * dedupes the 3 independent per-render callers the perf audit found
 * (`WealthOverview`, `getSafeToSpend`, `getLifeStageAndPriorities`).
 */
const getBudgetSummaryCached = cache(async (monthKey: string): Promise<BudgetSummary | null> => {
  const monthDate = new Date(`${monthKey}T00:00:00`);
  const budget = await getBudgetForMonth(monthKey);
  if (!budget) return null;

  const categories = await getBudgetCategories(budget.id);

  const from = monthKey;
  const to = toLocalDateString(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
  const transactions = await getTransactions({ from, to });

  const spentCents = calculateExpenses(transactions);
  const spendingByCategory = calculateSpendingByCategory(transactions).map((s) => ({
    categoryId: s.categoryId,
    totalCents: s.totalCents,
  }));

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === monthDate.getFullYear() && today.getMonth() === monthDate.getMonth();
  const totalDays = daysInMonth(monthDate.getFullYear(), monthDate.getMonth());
  const daysElapsed = isCurrentMonth ? today.getDate() : totalDays;

  const overall = calculateBudgetStatus(parseMoneyToCents(budget.total_budget), spentCents, daysElapsed, totalDays);

  const byCategory = calculateCategoryBudgetStatuses(
    categories.map((c) => ({
      categoryId: c.category_id,
      budgetCents: parseMoneyToCents(c.amount),
      isFixed: c.is_fixed,
      isEssential: c.is_essential,
    })),
    spendingByCategory,
    daysElapsed,
    totalDays
  );

  return { budget, categories, overall, byCategory };
});

/** Full budget-vs-actual summary for a given month, or null if no budget exists for that month yet. */
export function getBudgetSummary(monthDate: Date = new Date()): Promise<BudgetSummary | null> {
  return getBudgetSummaryCached(toMonthKey(monthDate));
}
