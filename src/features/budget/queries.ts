import "server-only";
import { cache } from "react";
import { throwDbError } from "@/lib/db-error";

import { createClient } from "@/lib/supabase/server";
import { getFinancialTransactions } from "@/features/transactions/queries";
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
  return data ?? carryBudgetForward(monthKey);
}

/**
 * A budget carries forward (2026-10-13, user request): a month with no
 * budget of its own gets a copy of the latest earlier month's — the total,
 * planned savings/investment and every category line — saved as that
 * month's own row. Saved, not borrowed, so editing October never rewrites
 * September (history stays as it was). Returns null when there's nothing
 * earlier to copy. Never throws: a failed copy just means "no budget yet".
 */
async function carryBudgetForward(monthKey: string): Promise<Budget | null> {
  try {
    const supabase = await createClient();
    const { data: source } = await supabase
      .from("budgets")
      .select("*")
      .lt("month", monthKey)
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!source) return null;

    // RLS scopes `source` to this user, so its user_id is the caller's own.
    const { data: inserted, error } = await supabase
      .from("budgets")
      .upsert(
        {
          user_id: source.user_id,
          month: monthKey,
          total_budget: source.total_budget,
          planned_savings: source.planned_savings,
          planned_investment: source.planned_investment,
          notes: source.notes,
        },
        { onConflict: "user_id,month", ignoreDuplicates: true }
      )
      .select("*")
      .maybeSingle();
    if (error) return null;
    // Another request carried it first: use theirs, don't copy lines twice.
    if (!inserted) {
      const { data: existing } = await supabase.from("budgets").select("*").eq("month", monthKey).maybeSingle();
      return existing;
    }

    const { data: lines } = await supabase
      .from("budget_categories")
      .select("category_id, amount, is_fixed, is_essential")
      .eq("budget_id", source.id);
    if (lines && lines.length > 0) {
      const { error: linesError } = await supabase
        .from("budget_categories")
        .insert(lines.map((line) => ({ ...line, budget_id: inserted.id })));
      if (linesError) {
        // Half a copy is worse than none: undo it so the next visit retries.
        await supabase.from("budgets").delete().eq("id", inserted.id);
        return null;
      }
    }
    return inserted;
  } catch {
    return null;
  }
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
  const from = monthKey;
  const to = toLocalDateString(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
  // The month's transactions depend only on the month, not on the budget,
  // so they load alongside the budget lookup instead of after it (one less
  // round trip on every page that uses this — WealthOverview,
  // getSafeToSpend(), getLifeStageAndPriorities()). Categories need the
  // budget id. The no-op catch only covers the no-budget early return.
  const transactionsPromise = getFinancialTransactions({ from, to });
  transactionsPromise.catch(() => undefined);
  const budget = await getBudgetForMonth(monthKey);
  if (!budget) return null;

  const [categories, transactions] = await Promise.all([getBudgetCategories(budget.id), transactionsPromise]);

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
