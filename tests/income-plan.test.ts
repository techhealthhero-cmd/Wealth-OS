import { describe, expect, it } from "vitest";

import { calculateGrowthProjection, calculateIncomePlan } from "@/lib/financial/income-plan";

describe("income path planner", () => {
  it("projects a tutoring plan from rate, weekly sessions, and working weeks", () => {
    const result = calculateIncomePlan({
      ratePerUnitCents: 20_000,
      unitsPerWeek: 5,
      hoursPerUnit: 1,
      activeWeeksPerYear: 48,
    });

    expect(result.weeklyIncomeCents).toBe(100_000);
    expect(result.monthlyIncomeCents).toBe(400_000);
    expect(result.yearlyIncomeCents).toBe(4_800_000);
    expect(result.monthlyHours).toBe(20);
    expect(result.effectiveHourlyCents).toBe(20_000);
  });

  it("models growth without changing the saved base assumptions", () => {
    const input = {
      ratePerUnitCents: 50_000,
      unitsPerWeek: 2,
      hoursPerUnit: 2,
      activeWeeksPerYear: 48,
    };

    expect(calculateGrowthProjection(input, "raise_rate").yearlyIncomeCents).toBe(5_760_000);
    expect(calculateGrowthProjection(input, "more_clients").yearlyIncomeCents).toBe(7_200_000);
    expect(calculateGrowthProjection(input, "scale").yearlyIncomeCents).toBe(12_000_000);
    expect(input).toMatchObject({ ratePerUnitCents: 50_000, unitsPerWeek: 2 });
  });

  it("never returns negative projections", () => {
    expect(calculateIncomePlan({
      ratePerUnitCents: -100,
      unitsPerWeek: -2,
      hoursPerUnit: -1,
      activeWeeksPerYear: -4,
    })).toMatchObject({
      weeklyIncomeCents: 0,
      monthlyIncomeCents: 0,
      yearlyIncomeCents: 0,
      weeklyHours: 0,
    });
  });
});
