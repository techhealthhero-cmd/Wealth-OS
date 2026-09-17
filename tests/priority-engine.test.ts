import { describe, expect, it } from "vitest";

import { getFinancialPriorities, getTopFinancialPriority, type PriorityEngineInputs } from "@/lib/financial/priority-engine";

const healthy: PriorityEngineInputs = {
  cashFlowCents: 500000,
  emergencyFundMonthsProtected: 6,
  emergencyFundTargetMonths: 6,
  essentialMonthlyExpensesCents: 1500000,
  emergencyFundCurrentCents: 9000000,
  highInterestLiabilities: [],
  savingsRatePercent: 25,
  hasInvestmentActivity: true,
  behindGoals: [],
  incomeGrowthPercent: 5,
};

describe("getFinancialPriorities — ordering", () => {
  it("negative cash flow always ranks first, even alongside other issues", () => {
    const priorities = getFinancialPriorities({
      ...healthy,
      cashFlowCents: -100000,
      emergencyFundMonthsProtected: 0,
      emergencyFundCurrentCents: 0,
    });
    expect(priorities[0].priorityType).toBe("negative_cash_flow");
    expect(priorities[0].severity).toBe("critical");
  });

  it("emergency fund ranks above high-interest debt", () => {
    const priorities = getFinancialPriorities({
      ...healthy,
      emergencyFundMonthsProtected: 0,
      emergencyFundCurrentCents: 0,
      highInterestLiabilities: [{ name: "Card", balanceCents: 500000, interestRatePercent: 24 }],
    });
    const emergencyIndex = priorities.findIndex((p) => p.priorityType === "no_emergency_fund");
    const debtIndex = priorities.findIndex((p) => p.priorityType === "high_interest_debt");
    expect(emergencyIndex).toBeGreaterThanOrEqual(0);
    expect(debtIndex).toBeGreaterThanOrEqual(0);
    expect(emergencyIndex).toBeLessThan(debtIndex);
  });

  it("flags the highest-interest-rate liability when several are high-interest", () => {
    const priorities = getFinancialPriorities({
      ...healthy,
      highInterestLiabilities: [
        { name: "Card A", balanceCents: 500000, interestRatePercent: 20 },
        { name: "Card B", balanceCents: 300000, interestRatePercent: 30 },
      ],
    });
    const debtPriority = priorities.find((p) => p.priorityType === "high_interest_debt");
    expect(debtPriority?.goalName).toBe("Card B");
  });
});

describe("getFinancialPriorities — savings priority", () => {
  it("flags a savings rate below 10%", () => {
    const priorities = getFinancialPriorities({ ...healthy, savingsRatePercent: 5 });
    expect(priorities.some((p) => p.priorityType === "low_savings_rate")).toBe(true);
  });

  it("does not flag a savings rate at or above 10%", () => {
    const priorities = getFinancialPriorities({ ...healthy, savingsRatePercent: 10 });
    expect(priorities.some((p) => p.priorityType === "low_savings_rate")).toBe(false);
  });

  it("does not flag low_savings_rate for a brand-new user with no income data yet (hasIncomeThisPeriod: false) — first-session bug fix", () => {
    // calculateSavingsRate([]) returns exactly 0 for "no transactions", which
    // is indistinguishable from a real 0% rate without this extra signal —
    // without the fix this incorrectly fired a "low savings rate" priority
    // for a user with zero real data.
    const priorities = getFinancialPriorities({ ...healthy, savingsRatePercent: 0, hasIncomeThisPeriod: false });
    expect(priorities.some((p) => p.priorityType === "low_savings_rate")).toBe(false);
  });

  it("still flags a genuinely low savings rate when income data does exist", () => {
    const priorities = getFinancialPriorities({ ...healthy, savingsRatePercent: 0, hasIncomeThisPeriod: true });
    expect(priorities.some((p) => p.priorityType === "low_savings_rate")).toBe(true);
  });

  it("defaults hasIncomeThisPeriod to true when omitted, preserving existing caller behavior", () => {
    const priorities = getFinancialPriorities({ ...healthy, savingsRatePercent: 5 });
    expect(priorities.some((p) => p.priorityType === "low_savings_rate")).toBe(true);
  });
});

describe("getFinancialPriorities — goal priority", () => {
  it("flags the most-behind goal with its required monthly contribution", () => {
    const priorities = getFinancialPriorities({
      ...healthy,
      behindGoals: [{ name: "Trip to Japan", requiredMonthlyContributionCents: 300000 }],
    });
    const goalPriority = priorities.find((p) => p.priorityType === "missed_goal");
    expect(goalPriority?.goalName).toBe("Trip to Japan");
    expect(goalPriority?.amountCents).toBe(300000);
  });
});

describe("getFinancialPriorities — edge cases", () => {
  it("a fully healthy financial picture returns no priorities at all", () => {
    expect(getFinancialPriorities(healthy)).toEqual([]);
  });

  it("does not suggest investing when cash flow is negative — bigger fires come first", () => {
    const priorities = getFinancialPriorities({
      ...healthy,
      cashFlowCents: -100000,
      hasInvestmentActivity: false,
    });
    expect(priorities.some((p) => p.priorityType === "no_investment_contribution")).toBe(false);
  });

  it("suggests investing only once cash flow and savings rate are already healthy", () => {
    const priorities = getFinancialPriorities({ ...healthy, hasInvestmentActivity: false });
    expect(priorities.some((p) => p.priorityType === "no_investment_contribution")).toBe(true);
  });

  it("does not penalize missing income-growth history (null) as weak income growth", () => {
    const priorities = getFinancialPriorities({ ...healthy, incomeGrowthPercent: null });
    expect(priorities.some((p) => p.priorityType === "weak_income_growth")).toBe(false);
  });

  it("flags genuinely declining income", () => {
    const priorities = getFinancialPriorities({ ...healthy, incomeGrowthPercent: -5 });
    expect(priorities.some((p) => p.priorityType === "weak_income_growth")).toBe(true);
  });
});

describe("getFinancialPriorities — income_gap (Day 5)", () => {
  it("does not fire when no income target is set (incomeGapCents omitted/null)", () => {
    const priorities = getFinancialPriorities(healthy);
    expect(priorities.some((p) => p.priorityType === "income_gap")).toBe(false);
  });

  it("does not fire when the income target is already achieved (gap is 0)", () => {
    const priorities = getFinancialPriorities({ ...healthy, incomeGapCents: 0 });
    expect(priorities.some((p) => p.priorityType === "income_gap")).toBe(false);
  });

  it("fires once a real income gap exists, ranked below missed goals but above savings rate", () => {
    const priorities = getFinancialPriorities({
      ...healthy,
      savingsRatePercent: 5, // also triggers low_savings_rate
      incomeGapCents: 500000,
    });
    const gapIndex = priorities.findIndex((p) => p.priorityType === "income_gap");
    const savingsIndex = priorities.findIndex((p) => p.priorityType === "low_savings_rate");
    expect(gapIndex).toBeGreaterThanOrEqual(0);
    expect(gapIndex).toBeLessThan(savingsIndex);
  });

  it("never outranks urgent safety issues like negative cash flow or emergency fund", () => {
    const priorities = getFinancialPriorities({
      ...healthy,
      cashFlowCents: -100000,
      emergencyFundMonthsProtected: 0,
      emergencyFundCurrentCents: 0,
      incomeGapCents: 5000000, // a very large gap — should still not jump the queue
    });
    expect(priorities[0].priorityType).toBe("negative_cash_flow");
    expect(priorities.some((p) => p.priorityType === "income_gap")).toBe(true);
    const gapIndex = priorities.findIndex((p) => p.priorityType === "income_gap");
    expect(gapIndex).toBeGreaterThan(priorities.findIndex((p) => p.priorityType === "negative_cash_flow"));
    expect(gapIndex).toBeGreaterThan(priorities.findIndex((p) => p.priorityType === "no_emergency_fund"));
  });

  it("raises severity when income is also heavily concentrated in one source", () => {
    const withoutConcentration = getFinancialPriorities({
      ...healthy,
      incomeGapCents: 100000, // small gap -> low severity on its own
      incomeConcentrationPercent: 50,
    });
    const withConcentration = getFinancialPriorities({
      ...healthy,
      incomeGapCents: 100000,
      incomeConcentrationPercent: 95,
    });
    const before = withoutConcentration.find((p) => p.priorityType === "income_gap");
    const after = withConcentration.find((p) => p.priorityType === "income_gap");
    expect(before?.severity).toBe("low");
    expect(after?.severity).toBe("medium");
  });
});

describe("getTopFinancialPriority", () => {
  it("returns the single highest-priority issue", () => {
    const top = getTopFinancialPriority({ ...healthy, cashFlowCents: -100000, savingsRatePercent: 2 });
    expect(top?.priorityType).toBe("negative_cash_flow");
  });

  it("returns null when nothing is actionable", () => {
    expect(getTopFinancialPriority(healthy)).toBeNull();
  });
});
