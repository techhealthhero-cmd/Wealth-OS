import { describe, expect, it } from "vitest";

import { calculateDebtPayoffPlan, calculatePayoffOrder, type DebtInput } from "@/lib/financial/debt-planner";

const cardA: DebtInput = { id: "a", name: "Card A", balanceCents: 500000, annualInterestRatePercent: 24, minimumPaymentCents: 20000 };
const cardB: DebtInput = { id: "b", name: "Card B", balanceCents: 1000000, annualInterestRatePercent: 12, minimumPaymentCents: 30000 };
const cardC: DebtInput = { id: "c", name: "Card C", balanceCents: 200000, annualInterestRatePercent: 30, minimumPaymentCents: 10000 };

describe("calculatePayoffOrder", () => {
  it("snowball orders smallest balance first", () => {
    expect(calculatePayoffOrder([cardA, cardB, cardC], "snowball")).toEqual(["c", "a", "b"]);
  });

  it("avalanche orders highest interest rate first", () => {
    expect(calculatePayoffOrder([cardA, cardB, cardC], "avalanche")).toEqual(["c", "a", "b"]);
  });

  it("custom uses the exact order given", () => {
    expect(calculatePayoffOrder([cardA, cardB, cardC], "custom", ["b", "a", "c"])).toEqual(["b", "a", "c"]);
  });

  it("custom appends any debt missing from the given order rather than dropping it", () => {
    expect(calculatePayoffOrder([cardA, cardB, cardC], "custom", ["b"])).toEqual(["b", "a", "c"]);
  });

  it("edge case: an interest rate of null is treated as 0% for avalanche ordering", () => {
    const noRate: DebtInput = { id: "d", name: "Informal debt", balanceCents: 100000, annualInterestRatePercent: null, minimumPaymentCents: 5000 };
    expect(calculatePayoffOrder([cardB, noRate], "avalanche")).toEqual(["b", "d"]);
  });
});

describe("calculateDebtPayoffPlan", () => {
  it("edge case: no debts at all returns a trivially-complete, zero-cost plan", () => {
    const result = calculateDebtPayoffPlan([], "avalanche", 0);
    expect(result.totalMonths).toBe(0);
    expect(result.totalInterestPaidCents).toBe(0);
    expect(result.monthlyDebtRequirementCents).toBe(0);
  });

  it("pays off a single zero-interest debt in exactly balance/payment months, with zero interest", () => {
    const debt: DebtInput = { id: "x", name: "Zero interest loan", balanceCents: 120000, annualInterestRatePercent: 0, minimumPaymentCents: 20000 };
    const result = calculateDebtPayoffPlan([debt], "avalanche", 0);
    expect(result.totalMonths).toBe(6);
    expect(result.totalInterestPaidCents).toBe(0);
    expect(result.perLiability[0].payoffMonth).toBe(6);
  });

  it("an extra monthly payment shortens the payoff time and reduces total interest vs. minimums-only", () => {
    const debt: DebtInput = { id: "x", name: "Card", balanceCents: 500000, annualInterestRatePercent: 24, minimumPaymentCents: 20000 };
    const withExtra = calculateDebtPayoffPlan([debt], "avalanche", 20000);
    const minimumOnly = calculateDebtPayoffPlan([debt], "avalanche", 0);

    expect(withExtra.totalMonths).not.toBeNull();
    expect(minimumOnly.totalMonths).not.toBeNull();
    expect(withExtra.totalMonths!).toBeLessThan(minimumOnly.totalMonths!);
    expect(withExtra.totalInterestSavedCents).toBeGreaterThan(0);
  });

  it("rolls a paid-off debt's minimum payment into the next debt's payoff (real snowball behavior)", () => {
    // Two debts, no extra payment configured — once the small one is paid
    // off, its minimum payment must roll onto the next, not just vanish.
    const small: DebtInput = { id: "small", name: "Small", balanceCents: 40000, annualInterestRatePercent: 0, minimumPaymentCents: 20000 };
    const large: DebtInput = { id: "large", name: "Large", balanceCents: 200000, annualInterestRatePercent: 0, minimumPaymentCents: 5000 };

    const withRollover = calculateDebtPayoffPlan([small, large], "snowball", 0);
    // Without rollover, "large" alone at 5000/month would take 40 months.
    // With the small debt's freed-up 20000/month rolling in after month 2,
    // it should finish considerably faster than 40 months.
    expect(withRollover.totalMonths).not.toBeNull();
    expect(withRollover.totalMonths!).toBeLessThan(40);
  });

  it("edge case: minimum payment doesn't cover accruing interest — balance never shrinks, plan never completes within the horizon", () => {
    const debt: DebtInput = {
      id: "trap",
      name: "Negative amortization trap",
      balanceCents: 1000000,
      annualInterestRatePercent: 36, // 3%/month
      minimumPaymentCents: 1000, // far below monthly interest (~30000)
    };
    const result = calculateDebtPayoffPlan([debt], "avalanche", 0, undefined, 60);
    expect(result.totalMonths).toBeNull();
    expect(result.perLiability[0].payoffMonth).toBeNull();
  });

  it("monthlyDebtRequirementCents sums every minimum payment plus the extra payment", () => {
    const result = calculateDebtPayoffPlan([cardA, cardB, cardC], "avalanche", 50000);
    expect(result.monthlyDebtRequirementCents).toBe(20000 + 30000 + 10000 + 50000);
  });
});
