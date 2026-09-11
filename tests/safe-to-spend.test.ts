import { describe, expect, it } from "vitest";

import { calculateSafeToSpend, type SafeToSpendInputs } from "@/lib/financial/safe-to-spend";

const baseInputs: SafeToSpendInputs = {
  availableLiquidCents: 5000000,
  upcomingBillsCents: 1000000,
  minimumDebtPaymentsCents: 500000,
  plannedSavingsCents: 500000,
  plannedInvestmentCents: 500000,
  protectedEmergencyFundCents: 1000000,
  mandatoryCommitmentsCents: 500000,
};

describe("calculateSafeToSpend", () => {
  it("subtracts every deduction from available liquid cash", () => {
    const result = calculateSafeToSpend(baseInputs, 15, 3);
    // 5,000,000 - 1,000,000 - 500,000 - 500,000 - 500,000 - 1,000,000 - 500,000 = 1,000,000
    expect(result.discretionaryCents).toBe(1000000);
  });

  it("splits the discretionary total across today/this week/this month", () => {
    const result = calculateSafeToSpend(baseInputs, 10, 2);
    expect(result.thisMonthCents).toBe(result.discretionaryCents);
    expect(result.todayCents).toBe(Math.floor(result.discretionaryCents / 10));
    expect(result.thisWeekCents).toBe(Math.floor(result.discretionaryCents / 2));
  });

  it("never goes negative — clamps to 0 when deductions exceed available cash", () => {
    const result = calculateSafeToSpend(
      { ...baseInputs, availableLiquidCents: 100000 },
      10,
      2
    );
    expect(result.discretionaryCents).toBe(0);
    expect(result.todayCents).toBe(0);
  });

  it("edge case: zero available cash and zero commitments", () => {
    const result = calculateSafeToSpend(
      {
        availableLiquidCents: 0,
        upcomingBillsCents: 0,
        minimumDebtPaymentsCents: 0,
        plannedSavingsCents: 0,
        plannedInvestmentCents: 0,
        protectedEmergencyFundCents: 0,
        mandatoryCommitmentsCents: 0,
      },
      30,
      4
    );
    expect(result.discretionaryCents).toBe(0);
  });

  it("does not divide by zero when days/weeks remaining is 0", () => {
    const result = calculateSafeToSpend(baseInputs, 0, 0);
    expect(Number.isFinite(result.todayCents)).toBe(true);
    expect(Number.isFinite(result.thisWeekCents)).toBe(true);
  });
});
