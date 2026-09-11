import { describe, expect, it } from "vitest";

import {
  calculateForecast,
  deriveConservativeAssumptions,
  deriveOptimisticAssumptions,
  scenarioExpenseChangeCents,
  scenarioExtraDebtPayment,
  scenarioExtraMonthlySavings,
  scenarioIncomeChangePercent,
  scenarioLoseIncome,
  scenarioOneTimeExpense,
  ZERO_ASSUMPTIONS,
  type ForecastAssumptions,
  type ForecastStartingState,
} from "@/lib/financial/forecast";

const baseState: ForecastStartingState = {
  cashBalanceCents: 5000000,
  monthlyIncomeCents: 4000000,
  monthlyExpensesCents: 3000000,
  netWorthCents: 10000000,
  totalDebtCents: 0,
};

describe("calculateForecast — base case", () => {
  it("produces one result row per month in the horizon", () => {
    const results = calculateForecast(baseState, ZERO_ASSUMPTIONS, 6);
    expect(results).toHaveLength(6);
    expect(results[0].month).toBe(1);
    expect(results[5].month).toBe(6);
  });

  it("with flat income/expenses and no allocations, cash grows by the monthly surplus every month", () => {
    const results = calculateForecast(baseState, ZERO_ASSUMPTIONS, 3);
    const monthlySurplus = baseState.monthlyIncomeCents - baseState.monthlyExpensesCents;
    expect(results[0].cashBalanceCents).toBe(baseState.cashBalanceCents + monthlySurplus);
    expect(results[1].cashBalanceCents).toBe(baseState.cashBalanceCents + monthlySurplus * 2);
  });

  it("net worth at month 1 reflects the starting net worth plus that month's surplus when nothing else changes", () => {
    const results = calculateForecast(baseState, ZERO_ASSUMPTIONS, 1);
    const monthlySurplus = baseState.monthlyIncomeCents - baseState.monthlyExpensesCents;
    expect(results[0].netWorthCents).toBe(baseState.netWorthCents + monthlySurplus);
  });

  it("edge case: zero income with ongoing expenses drains cash and never goes negative in netWorth calc unexpectedly", () => {
    const zeroIncomeState = { ...baseState, monthlyIncomeCents: 0 };
    const results = calculateForecast(zeroIncomeState, ZERO_ASSUMPTIONS, 3);
    expect(results[0].incomeCents).toBe(0);
    expect(results[2].cashBalanceCents).toBeLessThan(zeroIncomeState.cashBalanceCents);
  });

  it("edge case: negative cash flow (expenses exceed income) steadily reduces cash and net worth", () => {
    const negativeCashFlowState = { ...baseState, monthlyIncomeCents: 1000000, monthlyExpensesCents: 3000000 };
    const results = calculateForecast(negativeCashFlowState, ZERO_ASSUMPTIONS, 3);
    expect(results[2].cashBalanceCents).toBeLessThan(results[0].cashBalanceCents);
    expect(results[2].netWorthCents).toBeLessThan(results[0].netWorthCents);
  });

  it("allocations (savings/investment/debt payment) never exceed available cash that month", () => {
    const tightState = { ...baseState, cashBalanceCents: 0, monthlyIncomeCents: 100000, monthlyExpensesCents: 90000 };
    const heavyAssumptions: ForecastAssumptions = {
      ...ZERO_ASSUMPTIONS,
      monthlySavingsCents: 500000, // far more than the 10000 surplus available
    };
    const results = calculateForecast(tightState, heavyAssumptions, 1);
    // Cash can't go below 0 from allocations it can't afford.
    expect(results[0].cashBalanceCents).toBeGreaterThanOrEqual(0);
    expect(results[0].cumulativeSavingsCents).toBeLessThanOrEqual(10000);
  });

  it("a debt payment reduces the tracked debt balance and stops once debt reaches 0", () => {
    const debtState = { ...baseState, totalDebtCents: 50000 };
    const assumptions: ForecastAssumptions = { ...ZERO_ASSUMPTIONS, monthlyDebtPaymentCents: 30000 };
    const results = calculateForecast(debtState, assumptions, 3);
    expect(results[0].debtCents).toBe(20000);
    expect(results[1].debtCents).toBe(0);
    expect(results[2].debtCents).toBe(0); // never goes negative once paid off
  });

  it("applies a one-time income and one-time expense only in their specified month", () => {
    const assumptions: ForecastAssumptions = {
      ...ZERO_ASSUMPTIONS,
      oneTimeIncomeCents: 1000000,
      oneTimeIncomeMonth: 2,
      oneTimeExpenseCents: 500000,
      oneTimeExpenseMonth: 3,
    };
    const results = calculateForecast(baseState, assumptions, 4);
    const surplus = baseState.monthlyIncomeCents - baseState.monthlyExpensesCents;
    expect(results[0].cashBalanceCents).toBe(baseState.cashBalanceCents + surplus);
    expect(results[1].cashBalanceCents).toBe(results[0].cashBalanceCents + surplus + 1000000);
    expect(results[2].cashBalanceCents).toBe(results[1].cashBalanceCents + surplus - 500000);
  });
});

describe("scenario presets", () => {
  const activeAssumptions: ForecastAssumptions = {
    ...ZERO_ASSUMPTIONS,
    incomeGrowthRatePercent: 1,
    expenseGrowthRatePercent: 1,
    monthlySavingsCents: 100000,
    monthlyInvestmentCents: 50000,
  };

  it("conservative reduces income growth, increases expense growth, and reduces savings/investment", () => {
    const conservative = deriveConservativeAssumptions(activeAssumptions);
    expect(conservative.incomeGrowthRatePercent).toBeLessThan(activeAssumptions.incomeGrowthRatePercent);
    expect(conservative.expenseGrowthRatePercent).toBeGreaterThan(activeAssumptions.expenseGrowthRatePercent);
    expect(conservative.monthlySavingsCents).toBeLessThan(activeAssumptions.monthlySavingsCents);
  });

  it("optimistic increases income growth, decreases expense growth, and increases savings/investment", () => {
    const optimistic = deriveOptimisticAssumptions(activeAssumptions);
    expect(optimistic.incomeGrowthRatePercent).toBeGreaterThan(activeAssumptions.incomeGrowthRatePercent);
    expect(optimistic.expenseGrowthRatePercent).toBeLessThan(activeAssumptions.expenseGrowthRatePercent);
    expect(optimistic.monthlySavingsCents).toBeGreaterThan(activeAssumptions.monthlySavingsCents);
  });
});

describe("what-if scenario helpers", () => {
  it("scenarioExtraMonthlySavings adds to existing planned savings", () => {
    const result = scenarioExtraMonthlySavings(ZERO_ASSUMPTIONS, 500000);
    expect(result.monthlySavingsCents).toBe(500000);
  });

  it("scenarioExtraDebtPayment adds to existing planned debt payment", () => {
    const result = scenarioExtraDebtPayment(ZERO_ASSUMPTIONS, 300000);
    expect(result.monthlyDebtPaymentCents).toBe(300000);
  });

  it("scenarioIncomeChangePercent scales starting monthly income", () => {
    const result = scenarioIncomeChangePercent(baseState, 10);
    expect(result.monthlyIncomeCents).toBe(Math.round(baseState.monthlyIncomeCents * 1.1));
  });

  it("scenarioLoseIncome reduces income and never goes negative", () => {
    const result = scenarioLoseIncome(baseState, baseState.monthlyIncomeCents * 2);
    expect(result.monthlyIncomeCents).toBe(0);
  });

  it("scenarioExpenseChangeCents increases (e.g. rent increase) or decreases starting expenses", () => {
    const result = scenarioExpenseChangeCents(baseState, 500000);
    expect(result.monthlyExpensesCents).toBe(baseState.monthlyExpensesCents + 500000);
  });

  it("scenarioOneTimeExpense (e.g. buying a car) sets a one-time expense at a specific month", () => {
    const result = scenarioOneTimeExpense(ZERO_ASSUMPTIONS, 8000000, 5);
    expect(result.oneTimeExpenseCents).toBe(8000000);
    expect(result.oneTimeExpenseMonth).toBe(5);
  });
});
