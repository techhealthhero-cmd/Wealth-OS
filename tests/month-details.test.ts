import { describe, expect, it } from "vitest";

import {
  calculateMonthlyNetSeries,
  compareCategorySpending,
  groupTopCategories,
  samePeriodPreviousMonthEnd,
} from "@/lib/financial/month-details";

describe("calculateMonthlyNetSeries", () => {
  const transactions = [
    { type: "income" as const, amount: "30000.00", transaction_date: "2026-09-01" },
    { type: "expense" as const, amount: "16779.50", transaction_date: "2026-09-15" },
    { type: "income" as const, amount: "4000.00", transaction_date: "2026-10-03" },
    { type: "expense" as const, amount: "5917.50", transaction_date: "2026-10-20" },
    // Transfers alone don't make a month "have data".
    { type: "transfer" as const, amount: "500.00", transaction_date: "2026-08-10" },
    // Another year is ignored.
    { type: "income" as const, amount: "999.00", transaction_date: "2025-10-01" },
  ];

  const series = calculateMonthlyNetSeries(transactions, 2026, 9);

  it("always returns 12 months", () => {
    expect(series).toHaveLength(12);
    expect(series.map((p) => p.monthIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("computes income − expenses per month in cents", () => {
    expect(series[8]).toMatchObject({ incomeCents: 3_000_000, expensesCents: 1_677_950, netCents: 1_322_050, state: "data" });
    expect(series[9]).toMatchObject({ netCents: -191_750, state: "data", isCurrentMonth: true });
  });

  it("marks months without income/expense as empty and later months as future", () => {
    expect(series[0].state).toBe("empty");
    expect(series[7].state).toBe("empty");
    expect(series[10].state).toBe("future");
    expect(series[11].state).toBe("future");
  });
});

describe("samePeriodPreviousMonthEnd", () => {
  it("uses the same day of the previous month", () => {
    expect(samePeriodPreviousMonthEnd(new Date(2026, 9, 24))).toBe("2026-09-24");
  });

  it("clamps to the previous month's last day", () => {
    expect(samePeriodPreviousMonthEnd(new Date(2026, 2, 31))).toBe("2026-02-28");
    expect(samePeriodPreviousMonthEnd(new Date(2028, 2, 30))).toBe("2028-02-29");
  });

  it("crosses the year boundary in January", () => {
    expect(samePeriodPreviousMonthEnd(new Date(2027, 0, 15))).toBe("2026-12-15");
  });
});

describe("compareCategorySpending", () => {
  const rows = compareCategorySpending(
    [
      { categoryId: "food", totalCents: 188_800 },
      { categoryId: "family", totalCents: 121_150 },
      { categoryId: "health", totalCents: 57_500 },
      { categoryId: null, totalCents: 32_550 },
    ],
    [
      { categoryId: "food", totalCents: 420_000 },
      { categoryId: "family", totalCents: 80_000 },
      { categoryId: null, totalCents: 32_550 },
      { categoryId: "rent", totalCents: 800_000 },
    ]
  );

  it("labels each category's direction against the comparison period", () => {
    expect(rows.map((r) => r.change)).toEqual(["less", "more", "new", "same"]);
    expect(rows[0].deltaCents).toBe(-231_200);
    expect(rows[1].deltaCents).toBe(41_150);
    expect(rows[2].previousCents).toBe(0);
  });

  it("only lists this month's categories, with shares summing to 100", () => {
    expect(rows.map((r) => r.categoryId)).toEqual(["food", "family", "health", null]);
    expect(rows.reduce((s, r) => s + r.sharePercent, 0)).toBeCloseTo(100, 6);
  });

  it("returns zero shares when there is no spending", () => {
    expect(compareCategorySpending([{ categoryId: "x", totalCents: 0 }], [])[0].sharePercent).toBe(0);
  });
});

describe("groupTopCategories", () => {
  const rows = compareCategorySpending(
    [
      { categoryId: "a", totalCents: 500 },
      { categoryId: "b", totalCents: 300 },
      { categoryId: "c", totalCents: 150 },
      { categoryId: "d", totalCents: 50 },
    ],
    [
      { categoryId: "c", totalCents: 100 },
      { categoryId: "d", totalCents: 200 },
    ]
  );

  it("folds rows past the limit into one summed row", () => {
    const grouped = groupTopCategories(rows, 2);
    expect(grouped.top.map((r) => r.categoryId)).toEqual(["a", "b"]);
    expect(grouped.rest).toMatchObject({ count: 2, totalCents: 200, previousCents: 300, deltaCents: -100, change: "less" });
    expect(grouped.rest?.sharePercent).toBeCloseTo(20, 6);
  });

  it("leaves short lists untouched", () => {
    expect(groupTopCategories(rows, 5)).toEqual({ top: rows, rest: null });
  });

  it("never folds a single leftover row into 'Other (1)'", () => {
    expect(groupTopCategories(rows, 3)).toEqual({ top: rows, rest: null });
  });
});
