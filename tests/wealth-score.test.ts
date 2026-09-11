import { describe, expect, it } from "vitest";

import {
  calculateCashFlowScore,
  calculateDebtHealthScore,
  calculateEmergencyFundScore,
  calculateGoalProgressScore,
  calculateIncomeGrowthScore,
  calculateNetWorthGrowthScore,
  calculateSavingsScore,
  calculateWealthScore,
  getWealthScoreImprovementActions,
  WEALTH_SCORE_CALCULATION_VERSION,
  type WealthScoreComponents,
} from "@/lib/financial/wealth-score";

describe("calculateCashFlowScore", () => {
  it("scores breakeven cash flow as neutral (50)", () => {
    expect(calculateCashFlowScore(4000000, 0)).toBe(50);
  });

  it("scores fully-saved income (cash flow == income) as 100", () => {
    expect(calculateCashFlowScore(4000000, 4000000)).toBe(100);
  });

  it("scores negative cash flow below 50", () => {
    expect(calculateCashFlowScore(4000000, -2000000)).toBeLessThan(50);
  });

  it("edge case: zero income with negative cash flow (spending with no income) scores 0", () => {
    expect(calculateCashFlowScore(0, -100000)).toBe(0);
  });

  it("edge case: zero income and zero cash flow scores neutral", () => {
    expect(calculateCashFlowScore(0, 0)).toBe(50);
  });
});

describe("calculateSavingsScore", () => {
  it("treats a 20% savings rate as full marks", () => {
    expect(calculateSavingsScore(20)).toBe(100);
  });

  it("scales linearly below 20%", () => {
    expect(calculateSavingsScore(10)).toBeCloseTo(50);
  });

  it("edge case: negative savings rate clamps to 0", () => {
    expect(calculateSavingsScore(-30)).toBe(0);
  });

  it("edge case: zero income / zero savings rate scores 0", () => {
    expect(calculateSavingsScore(0)).toBe(0);
  });
});

describe("calculateEmergencyFundScore", () => {
  it("scores full marks once the target months of coverage is reached", () => {
    expect(calculateEmergencyFundScore(6, 6)).toBe(100);
  });

  it("edge case: no emergency fund saved scores 0 (a real, meaningful gap, not 'missing data')", () => {
    expect(calculateEmergencyFundScore(0, 6)).toBe(0);
  });

  it("uses a default 6-month target when none is given", () => {
    expect(calculateEmergencyFundScore(3)).toBeCloseTo(50);
  });
});

describe("calculateDebtHealthScore", () => {
  it("scores 100 when there are no liabilities at all", () => {
    expect(calculateDebtHealthScore(4000000, 0)).toBe(100);
  });

  it("edge case: debt-heavy user (high payments relative to income) scores low", () => {
    const score = calculateDebtHealthScore(3000000, 1500000); // 50% of income to debt
    expect(score).toBe(0);
  });

  it("edge case: liabilities but zero income scores 0", () => {
    expect(calculateDebtHealthScore(0, 500000)).toBe(0);
  });
});

describe("net worth / income growth scores — missing history fairness", () => {
  it("returns neutral 50 with hasHistory:false when there is no prior snapshot", () => {
    const result = calculateNetWorthGrowthScore(1000000, null);
    expect(result.score).toBe(50);
    expect(result.hasHistory).toBe(false);
  });

  it("returns neutral 50 with hasHistory:false for income growth with no prior month", () => {
    const result = calculateIncomeGrowthScore(4000000, null);
    expect(result.score).toBe(50);
    expect(result.hasHistory).toBe(false);
  });

  it("scores positive net worth growth above 50 once history exists", () => {
    const result = calculateNetWorthGrowthScore(1200000, 1000000);
    expect(result.hasHistory).toBe(true);
    expect(result.score).toBeGreaterThan(50);
  });

  it("scores a net worth decline below 50", () => {
    const result = calculateNetWorthGrowthScore(800000, 1000000);
    expect(result.score).toBeLessThan(50);
  });
});

describe("calculateGoalProgressScore", () => {
  it("averages progress across active goals", () => {
    expect(calculateGoalProgressScore([50, 100])).toBe(75);
  });

  it("edge case: no goals at all scores neutral (50), not a penalty", () => {
    expect(calculateGoalProgressScore([])).toBe(50);
  });

  it("edge case: a goal already fully achieved contributes 100", () => {
    expect(calculateGoalProgressScore([100])).toBe(100);
  });
});

describe("calculateWealthScore", () => {
  it("weights components according to the spec (20/15/15/15/15/10/10)", () => {
    const components: WealthScoreComponents = {
      cashFlowScore: 100,
      savingsScore: 0,
      emergencyFundScore: 0,
      debtHealthScore: 0,
      netWorthGrowthScore: 0,
      incomeGrowthScore: 0,
      goalProgressScore: 0,
    };
    const result = calculateWealthScore(components);
    expect(result.totalScore).toBeCloseTo(20); // only cashFlow (20% weight) is non-zero
    expect(result.calculationVersion).toBe(WEALTH_SCORE_CALCULATION_VERSION);
  });

  it("scores 100 when every component is perfect", () => {
    const perfect: WealthScoreComponents = {
      cashFlowScore: 100,
      savingsScore: 100,
      emergencyFundScore: 100,
      debtHealthScore: 100,
      netWorthGrowthScore: 100,
      incomeGrowthScore: 100,
      goalProgressScore: 100,
    };
    expect(calculateWealthScore(perfect).totalScore).toBe(100);
  });

  it("scores 0 when every component is 0 (e.g. a brand-new user with negative cash flow and no data)", () => {
    const worst: WealthScoreComponents = {
      cashFlowScore: 0,
      savingsScore: 0,
      emergencyFundScore: 0,
      debtHealthScore: 0,
      netWorthGrowthScore: 0,
      incomeGrowthScore: 0,
      goalProgressScore: 0,
    };
    expect(calculateWealthScore(worst).totalScore).toBe(0);
  });

  it("a new user with only neutral (50) growth/goal scores lands at 50 overall when other components are also neutral", () => {
    const neutral: WealthScoreComponents = {
      cashFlowScore: 50,
      savingsScore: 50,
      emergencyFundScore: 50,
      debtHealthScore: 50,
      netWorthGrowthScore: 50,
      incomeGrowthScore: 50,
      goalProgressScore: 50,
    };
    expect(calculateWealthScore(neutral).totalScore).toBe(50);
  });
});

describe("getWealthScoreImprovementActions", () => {
  const lowComponents: WealthScoreComponents = {
    cashFlowScore: 40,
    savingsScore: 30,
    emergencyFundScore: 20,
    debtHealthScore: 50,
    netWorthGrowthScore: 50,
    incomeGrowthScore: 50,
    goalProgressScore: 40,
  };

  it("returns a measurable emergency-fund action with a concrete amount when the score is low", () => {
    const actions = getWealthScoreImprovementActions({
      components: lowComponents,
      essentialMonthlyExpensesCents: 1500000,
      emergencyFundCurrentCents: 3000000,
      emergencyFundTargetMonths: 6,
      incomeCents: 4000000,
      cashFlowCents: -500000,
      savingsRatePercent: 5,
      minimumDebtPaymentsCents: 0,
      goals: [],
    });

    const efAction = actions.find((a) => a.type === "increase_emergency_fund");
    expect(efAction).toBeDefined();
    expect(efAction!.amountCents).toBe(9000000 - 3000000);
  });

  it("returns a savings-rate target action when savings score is low", () => {
    const actions = getWealthScoreImprovementActions({
      components: lowComponents,
      essentialMonthlyExpensesCents: 0,
      emergencyFundCurrentCents: 0,
      emergencyFundTargetMonths: 6,
      incomeCents: 4000000,
      cashFlowCents: 500000,
      savingsRatePercent: 5,
      minimumDebtPaymentsCents: 0,
      goals: [],
    });
    const savingsAction = actions.find((a) => a.type === "improve_savings_rate");
    expect(savingsAction).toBeDefined();
    expect(savingsAction!.targetPercent).toBe(20);
  });

  it("returns a discretionary-spending reduction action only when cash flow is actually negative", () => {
    const actions = getWealthScoreImprovementActions({
      components: lowComponents,
      essentialMonthlyExpensesCents: 0,
      emergencyFundCurrentCents: 9000000,
      emergencyFundTargetMonths: 6,
      incomeCents: 4000000,
      cashFlowCents: -300000,
      savingsRatePercent: 5,
      minimumDebtPaymentsCents: 0,
      goals: [],
    });
    const spendAction = actions.find((a) => a.type === "reduce_discretionary_spending");
    expect(spendAction).toBeDefined();
    expect(spendAction!.amountCents).toBe(300000);
  });

  it("does not suggest reducing spending when cash flow is already positive", () => {
    const actions = getWealthScoreImprovementActions({
      components: { ...lowComponents, cashFlowScore: 40 },
      essentialMonthlyExpensesCents: 0,
      emergencyFundCurrentCents: 9000000,
      emergencyFundTargetMonths: 6,
      incomeCents: 4000000,
      cashFlowCents: 200000,
      savingsRatePercent: 5,
      minimumDebtPaymentsCents: 0,
      goals: [],
    });
    expect(actions.find((a) => a.type === "reduce_discretionary_spending")).toBeUndefined();
  });

  it("suggests contributing to the most-behind active goal, with its own required monthly contribution", () => {
    const actions = getWealthScoreImprovementActions({
      components: lowComponents,
      essentialMonthlyExpensesCents: 0,
      emergencyFundCurrentCents: 9000000,
      emergencyFundTargetMonths: 6,
      incomeCents: 4000000,
      cashFlowCents: 500000,
      savingsRatePercent: 5,
      minimumDebtPaymentsCents: 0,
      goals: [
        { name: "Trip to Japan", progressPercent: 20, requiredMonthlyContributionCents: 300000 },
        { name: "New laptop", progressPercent: 80, requiredMonthlyContributionCents: 50000 },
      ],
    });
    const goalAction = actions.find((a) => a.type === "contribute_to_goal");
    expect(goalAction).toBeDefined();
    expect(goalAction!.goalName).toBe("Trip to Japan");
    expect(goalAction!.amountCents).toBe(300000);
  });

  it("suggests reducing debt payments by the gap to a healthy threshold, never the full payment amount", () => {
    const actions = getWealthScoreImprovementActions({
      components: lowComponents,
      essentialMonthlyExpensesCents: 0,
      emergencyFundCurrentCents: 9000000,
      emergencyFundTargetMonths: 6,
      incomeCents: 4000000,
      cashFlowCents: 500000,
      savingsRatePercent: 5,
      minimumDebtPaymentsCents: 1000000,
      goals: [],
    });
    const debtAction = actions.find((a) => a.type === "reduce_debt_payments");
    expect(debtAction).toBeDefined();
    // income*0.05 = 200000 is the payment level that reaches the threshold;
    // the suggested reduction is the gap to it, not the full 1,000,000 payment.
    expect(debtAction!.amountCents).toBe(800000);
    expect(debtAction!.amountCents).toBeLessThan(1000000);
  });

  it("edge case: returns no actions when every component already scores at/above the threshold", () => {
    const greatComponents: WealthScoreComponents = {
      cashFlowScore: 100,
      savingsScore: 100,
      emergencyFundScore: 100,
      debtHealthScore: 100,
      netWorthGrowthScore: 100,
      incomeGrowthScore: 100,
      goalProgressScore: 100,
    };
    const actions = getWealthScoreImprovementActions({
      components: greatComponents,
      essentialMonthlyExpensesCents: 1500000,
      emergencyFundCurrentCents: 9000000,
      emergencyFundTargetMonths: 6,
      incomeCents: 4000000,
      cashFlowCents: 1000000,
      savingsRatePercent: 25,
      minimumDebtPaymentsCents: 0,
      goals: [],
    });
    expect(actions).toEqual([]);
  });
});
