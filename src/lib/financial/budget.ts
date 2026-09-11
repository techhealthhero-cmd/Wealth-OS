/**
 * Smart Budget — deterministic budget-status math. No LLM, no external
 * calls: every number here is derived purely from its inputs so it's cheap
 * to unit test and impossible to get a different answer on a re-render.
 */

export type BudgetHealthStatus = "no_budget" | "healthy" | "near_limit" | "over_budget";

export interface BudgetStatus {
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  /** 0-100+; can exceed 100 when over budget. 0 when budgetCents is 0 and nothing was spent. */
  percentUsed: number;
  /** Linear projection: spentCents / daysElapsed * daysInMonth. Equals spentCents once the month is over. */
  projectedEndOfMonthCents: number;
  status: BudgetHealthStatus;
}

const NEAR_LIMIT_THRESHOLD_PERCENT = 90;

/**
 * @param budgetCents Planned amount for this budget/category, in cents.
 * @param spentCents Actual spend so far this month, in cents.
 * @param daysElapsed Days elapsed in the month so far, INCLUDING today (1..daysInMonth).
 * @param daysInMonth Total days in the month.
 */
export function calculateBudgetStatus(
  budgetCents: number,
  spentCents: number,
  daysElapsed: number,
  daysInMonth: number
): BudgetStatus {
  const remainingCents = budgetCents - spentCents;
  const percentUsed = budgetCents > 0 ? (spentCents / budgetCents) * 100 : spentCents > 0 ? 100 : 0;

  const safeDaysElapsed = Math.max(1, Math.min(daysElapsed, daysInMonth));
  const projectedEndOfMonthCents = Math.round((spentCents / safeDaysElapsed) * daysInMonth);

  let status: BudgetHealthStatus;
  if (budgetCents <= 0) {
    status = spentCents > 0 ? "over_budget" : "no_budget";
  } else if (spentCents > budgetCents) {
    status = "over_budget";
  } else if (percentUsed >= NEAR_LIMIT_THRESHOLD_PERCENT || projectedEndOfMonthCents > budgetCents) {
    status = "near_limit";
  } else {
    status = "healthy";
  }

  return { budgetCents, spentCents, remainingCents, percentUsed, projectedEndOfMonthCents, status };
}

export interface CategoryBudgetInput {
  categoryId: string;
  budgetCents: number;
  isFixed: boolean;
  isEssential: boolean;
}

export interface CategorySpendingInput {
  categoryId: string | null;
  totalCents: number;
}

export interface CategoryBudgetStatus extends BudgetStatus {
  categoryId: string;
  isFixed: boolean;
  isEssential: boolean;
}

/** Joins each category's budget allocation against actual spend for that category. */
export function calculateCategoryBudgetStatuses(
  categoryBudgets: CategoryBudgetInput[],
  spendingByCategory: CategorySpendingInput[],
  daysElapsed: number,
  daysInMonth: number
): CategoryBudgetStatus[] {
  const spentByCategory = new Map(spendingByCategory.map((s) => [s.categoryId, s.totalCents]));

  return categoryBudgets.map((cb) => {
    const spentCents = spentByCategory.get(cb.categoryId) ?? 0;
    const status = calculateBudgetStatus(cb.budgetCents, spentCents, daysElapsed, daysInMonth);
    return { ...status, categoryId: cb.categoryId, isFixed: cb.isFixed, isEssential: cb.isEssential };
  });
}

/** Days in the given month (1-indexed month, matching JS Date's getMonth()+1 convention when called with monthIndex0). */
export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}
