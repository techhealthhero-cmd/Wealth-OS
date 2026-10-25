import { describe, expect, it } from "vitest";

import { calculateMonthlyNetSeries } from "@/lib/financial/month-details";

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
