import { describe, expect, it } from "vitest";

import {
  calculateBudgetStatus,
  calculateCategoryBudgetStatuses,
  daysInMonth,
} from "@/lib/financial/budget";

describe("calculateBudgetStatus", () => {
  it("reports healthy when well under budget", () => {
    const status = calculateBudgetStatus(1000000, 300000, 10, 30);
    expect(status.remainingCents).toBe(700000);
    expect(status.percentUsed).toBeCloseTo(30);
    expect(status.status).toBe("healthy");
  });

  it("reports near_limit at 90%+ used", () => {
    const status = calculateBudgetStatus(1000000, 920000, 25, 30);
    expect(status.status).toBe("near_limit");
  });

  it("reports near_limit when the linear projection would exceed budget, even under 90% used", () => {
    // 5 days in, already spent 40% of budget -> projected full month = 240%.
    const status = calculateBudgetStatus(1000000, 400000, 5, 30);
    expect(status.percentUsed).toBeLessThan(90);
    expect(status.projectedEndOfMonthCents).toBeGreaterThan(1000000);
    expect(status.status).toBe("near_limit");
  });

  it("reports over_budget once spending exceeds the budget", () => {
    const status = calculateBudgetStatus(1000000, 1100000, 30, 30);
    expect(status.status).toBe("over_budget");
    expect(status.remainingCents).toBe(-100000);
  });

  it("edge case: budget of 0 with no spending is no_budget, not over_budget", () => {
    const status = calculateBudgetStatus(0, 0, 10, 30);
    expect(status.status).toBe("no_budget");
    expect(status.percentUsed).toBe(0);
  });

  it("edge case: budget of 0 with any spending is over_budget", () => {
    const status = calculateBudgetStatus(0, 500, 10, 30);
    expect(status.status).toBe("over_budget");
  });

  it("edge case: zero expenses against a positive budget is healthy", () => {
    const status = calculateBudgetStatus(500000, 0, 15, 30);
    expect(status.status).toBe("healthy");
    expect(status.projectedEndOfMonthCents).toBe(0);
  });

  it("does not divide by zero when daysElapsed is 0", () => {
    const status = calculateBudgetStatus(500000, 0, 0, 30);
    expect(Number.isFinite(status.projectedEndOfMonthCents)).toBe(true);
  });
});

describe("calculateCategoryBudgetStatuses", () => {
  it("joins category budgets against actual spend by category", () => {
    const result = calculateCategoryBudgetStatuses(
      [
        { categoryId: "food", budgetCents: 500000, isFixed: false, isEssential: true },
        { categoryId: "entertainment", budgetCents: 200000, isFixed: false, isEssential: false },
      ],
      [{ categoryId: "food", totalCents: 450000 }],
      15,
      30
    );

    const food = result.find((r) => r.categoryId === "food")!;
    const entertainment = result.find((r) => r.categoryId === "entertainment")!;

    expect(food.spentCents).toBe(450000);
    expect(food.status).toBe("near_limit");
    expect(entertainment.spentCents).toBe(0);
    expect(entertainment.status).toBe("healthy");
  });

  it("returns an empty array for an overspent category with no allocations at all", () => {
    expect(calculateCategoryBudgetStatuses([], [{ categoryId: "food", totalCents: 100 }], 1, 30)).toEqual([]);
  });
});

describe("daysInMonth", () => {
  it("returns 28 for February in a non-leap year", () => {
    expect(daysInMonth(2025, 1)).toBe(28);
  });

  it("returns 29 for February in a leap year", () => {
    expect(daysInMonth(2024, 1)).toBe(29);
  });

  it("returns 31 for January", () => {
    expect(daysInMonth(2026, 0)).toBe(31);
  });
});
