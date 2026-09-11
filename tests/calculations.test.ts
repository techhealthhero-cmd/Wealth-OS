import { describe, expect, it } from "vitest";

import {
  calculateAccountBalance,
  calculateDebtReductionContributions,
  calculateExpenses,
  calculateIncome,
  calculateInvestmentContributions,
  calculateMonthlyCashFlow,
  calculateSavingsContributions,
  calculateSavingsRate,
  calculateSpendingByCategory,
  type FinancialTransaction,
} from "@/lib/financial/calculations";

const salary: FinancialTransaction = { type: "income", amount: "40000.00" };
const rent: FinancialTransaction = { type: "expense", amount: "8000.00", category_id: "housing" };
const food: FinancialTransaction = { type: "expense", amount: "6500.50", category_id: "food" };
const transferOut: FinancialTransaction = { type: "transfer", amount: "2000.00" };
const refund: FinancialTransaction = { type: "refund", amount: "500.00" };

describe("calculateIncome", () => {
  it("sums only income transactions", () => {
    expect(calculateIncome([salary, rent, food])).toBe(4000000);
  });

  it("returns 0 for no transactions", () => {
    expect(calculateIncome([])).toBe(0);
  });
});

describe("calculateExpenses", () => {
  it("sums expense transactions", () => {
    expect(calculateExpenses([rent, food])).toBe(800000 + 650050);
  });

  it("nets refunds against expenses (refund reduces expense total)", () => {
    expect(calculateExpenses([rent, refund])).toBe(800000 - 50000);
  });

  it("excludes transfers, debt payments, savings transfers, and investment allocations", () => {
    const mixed: FinancialTransaction[] = [
      rent,
      transferOut,
      { type: "debt_payment", amount: "1000.00" },
      { type: "savings_transfer", amount: "1000.00" },
      { type: "investment_allocation", amount: "1000.00" },
    ];
    expect(calculateExpenses(mixed)).toBe(800000);
  });

  it("never goes negative-surprising with large refunds (documented net behavior)", () => {
    const bigRefund: FinancialTransaction = { type: "refund", amount: "10000.00" };
    expect(calculateExpenses([rent, bigRefund])).toBe(800000 - 1000000);
  });
});

describe("calculateMonthlyCashFlow", () => {
  it("computes income minus expenses, excluding transfers", () => {
    const cashFlow = calculateMonthlyCashFlow([salary, rent, food, transferOut]);
    expect(cashFlow).toBe(4000000 - (800000 + 650050));
  });

  it("can be negative when expenses exceed income", () => {
    const overspend: FinancialTransaction[] = [
      { type: "income", amount: "1000.00" },
      { type: "expense", amount: "5000.00" },
    ];
    expect(calculateMonthlyCashFlow(overspend)).toBe(100000 - 500000);
    expect(calculateMonthlyCashFlow(overspend)).toBeLessThan(0);
  });
});

describe("calculateSavingsRate", () => {
  it("computes (income - expenses) / income * 100", () => {
    const rate = calculateSavingsRate([salary, rent, food]);
    const expected = ((4000000 - (800000 + 650050)) / 4000000) * 100;
    expect(rate).toBeCloseTo(expected, 6);
  });

  it("returns 0 when income is 0, instead of NaN/Infinity", () => {
    expect(calculateSavingsRate([rent])).toBe(0);
    expect(calculateSavingsRate([])).toBe(0);
  });

  it("can be negative when expenses exceed income", () => {
    const overspend: FinancialTransaction[] = [
      { type: "income", amount: "1000.00" },
      { type: "expense", amount: "5000.00" },
    ];
    expect(calculateSavingsRate(overspend)).toBeLessThan(0);
  });

  it("handles decimal amounts correctly", () => {
    const decimalCase: FinancialTransaction[] = [
      { type: "income", amount: "100.33" },
      { type: "expense", amount: "33.11" },
    ];
    const rate = calculateSavingsRate(decimalCase);
    expect(rate).toBeCloseTo(((10033 - 3311) / 10033) * 100, 6);
  });
});

describe("calculateAccountBalance", () => {
  it("starts from opening balance with no transactions", () => {
    expect(calculateAccountBalance("5000.00", "acc-1", [])).toBe(500000);
  });

  it("credits income and refunds, debits expenses", () => {
    const txns = [
      { ...salary, account_id: "acc-1" },
      { ...rent, account_id: "acc-1" },
      { ...refund, account_id: "acc-1" },
    ];
    expect(calculateAccountBalance("0.00", "acc-1", txns)).toBe(
      4000000 - 800000 + 50000
    );
  });

  it("debits the from_account and credits the to_account for transfers", () => {
    const txns = [
      { type: "transfer" as const, amount: "2000.00", from_account_id: "acc-1", to_account_id: "acc-2" },
    ];
    expect(calculateAccountBalance("5000.00", "acc-1", txns)).toBe(500000 - 200000);
    expect(calculateAccountBalance("0.00", "acc-2", txns)).toBe(200000);
  });

  it("ignores transactions belonging to a different account", () => {
    const txns = [{ ...rent, account_id: "acc-other" }];
    expect(calculateAccountBalance("1000.00", "acc-1", txns)).toBe(100000);
  });
});

describe("calculateSpendingByCategory", () => {
  it("groups expense totals by category, sorted descending", () => {
    const result = calculateSpendingByCategory([rent, food, { ...food, amount: "5000.00" }]);
    expect(result[0]).toEqual({ categoryId: "food", totalCents: 650050 + 500000 });
    expect(result[1]).toEqual({ categoryId: "housing", totalCents: 800000 });
  });

  it("returns an empty array for no expenses", () => {
    expect(calculateSpendingByCategory([salary, transferOut])).toEqual([]);
  });
});

describe("calculateSavingsContributions / calculateInvestmentContributions / calculateDebtReductionContributions", () => {
  const savingsTransfer: FinancialTransaction = { type: "savings_transfer", amount: "3000.00" };
  const investmentAllocation: FinancialTransaction = { type: "investment_allocation", amount: "2000.00" };
  const debtPayment: FinancialTransaction = { type: "debt_payment", amount: "1500.00" };

  it("each sums only its own transaction type", () => {
    const all = [salary, rent, savingsTransfer, investmentAllocation, debtPayment];
    expect(calculateSavingsContributions(all)).toBe(300000);
    expect(calculateInvestmentContributions(all)).toBe(200000);
    expect(calculateDebtReductionContributions(all)).toBe(150000);
  });

  it("returns 0 for no matching transactions", () => {
    expect(calculateSavingsContributions([salary, rent])).toBe(0);
    expect(calculateInvestmentContributions([])).toBe(0);
    expect(calculateDebtReductionContributions([refund])).toBe(0);
  });
});
