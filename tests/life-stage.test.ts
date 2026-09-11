import { describe, expect, it } from "vitest";

import { calculateFinancialLifeStage, type LifeStageInputs } from "@/lib/financial/life-stage";

const perfect: LifeStageInputs = {
  cashFlowCents: 500000,
  emergencyFundMonthsProtected: 6,
  hasHighInterestDebt: false,
  savingsRatePercent: 25,
  hasInvestmentActivity: true,
  netWorthCents: 100000000,
  annualExpensesCents: 3600000,
};

describe("calculateFinancialLifeStage — stage boundaries", () => {
  it("negative cash flow lands in survival, regardless of anything else", () => {
    const result = calculateFinancialLifeStage({ ...perfect, cashFlowCents: -1000 });
    expect(result.stage).toBe("survival");
  });

  it("non-negative cash flow with no emergency fund lands in stable", () => {
    const result = calculateFinancialLifeStage({ ...perfect, emergencyFundMonthsProtected: 0 });
    expect(result.stage).toBe("stable");
  });

  it("3+ months emergency fund but high-interest debt lands in protected", () => {
    const result = calculateFinancialLifeStage({ ...perfect, hasHighInterestDebt: true });
    expect(result.stage).toBe("protected");
  });

  it("no high-interest debt but low savings rate / no investing lands in debt_controlled", () => {
    const result = calculateFinancialLifeStage({ ...perfect, savingsRatePercent: 5, hasInvestmentActivity: false });
    expect(result.stage).toBe("debt_controlled");
  });

  it("investing with a 10-19% savings rate lands in investor, not wealth_builder", () => {
    const result = calculateFinancialLifeStage({ ...perfect, savingsRatePercent: 15 });
    expect(result.stage).toBe("investor");
  });

  it("20%+ savings rate and positive net worth lands in wealth_builder", () => {
    const result = calculateFinancialLifeStage({ ...perfect, netWorthCents: 1000000 });
    expect(result.stage).toBe("wealth_builder");
  });

  it("net worth at 25x annual expenses reaches financial_freedom", () => {
    const result = calculateFinancialLifeStage(perfect);
    expect(result.stage).toBe("financial_freedom");
  });

  it("net worth just under the 25x threshold stays at wealth_builder, not financial_freedom", () => {
    const result = calculateFinancialLifeStage({ ...perfect, netWorthCents: perfect.annualExpensesCents * 25 - 1 });
    expect(result.stage).toBe("wealth_builder");
  });
});

describe("calculateFinancialLifeStage — missing data", () => {
  it("a brand-new user with no data at all lands in stable (0 cash flow is not negative)", () => {
    const result = calculateFinancialLifeStage({
      cashFlowCents: 0,
      emergencyFundMonthsProtected: 0,
      hasHighInterestDebt: false,
      savingsRatePercent: 0,
      hasInvestmentActivity: false,
      netWorthCents: 0,
      annualExpensesCents: 0,
    });
    expect(result.stage).toBe("stable");
  });

  it("no liabilities at all does not block debt_controlled (hasHighInterestDebt correctly false)", () => {
    const result = calculateFinancialLifeStage({ ...perfect, savingsRatePercent: 5, hasInvestmentActivity: false, hasHighInterestDebt: false });
    expect(result.stage).toBe("debt_controlled");
  });

  it("zero annual expenses never accidentally satisfies financial_freedom", () => {
    const result = calculateFinancialLifeStage({ ...perfect, annualExpensesCents: 0 });
    expect(result.stage).not.toBe("financial_freedom");
  });
});

describe("calculateFinancialLifeStage — regression to an earlier stage", () => {
  it("a user who reaches wealth_builder but then runs negative cash flow regresses to survival", () => {
    const wealthy = calculateFinancialLifeStage(perfect);
    expect(wealthy.stage).toBe("financial_freedom");

    const regressed = calculateFinancialLifeStage({ ...perfect, cashFlowCents: -500 });
    expect(regressed.stage).toBe("survival");
  });

  it("reports the correct next stage and unmet requirement", () => {
    const result = calculateFinancialLifeStage({ ...perfect, hasHighInterestDebt: true });
    expect(result.stage).toBe("protected");
    expect(result.nextStage).toBe("debt_controlled");
    expect(result.nextStageRequirements).toHaveLength(1);
    expect(result.nextStageRequirements[0].met).toBe(false);
  });

  it("financial_freedom has no next stage", () => {
    const result = calculateFinancialLifeStage(perfect);
    expect(result.nextStage).toBeNull();
    expect(result.nextStageRequirements).toEqual([]);
  });
});
