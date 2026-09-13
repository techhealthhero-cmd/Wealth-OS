import { describe, expect, it } from "vitest";

import { calculateIncomeGap } from "@/lib/financial/income-gap";

describe("calculateIncomeGap", () => {
  it("reports the exact gap when the target is above current average income", () => {
    const result = calculateIncomeGap({ targetMonthlyIncomeCents: 5000000, averageMonthlyIncomeCents: 3500000 });
    expect(result.hasTarget).toBe(true);
    expect(result.achieved).toBe(false);
    expect(result.gapCents).toBe(1500000);
  });

  it("reports achieved (gap clamped to 0) when the target is below current average income", () => {
    const result = calculateIncomeGap({ targetMonthlyIncomeCents: 3000000, averageMonthlyIncomeCents: 3500000 });
    expect(result.achieved).toBe(true);
    expect(result.gapCents).toBe(0);
  });

  it("reports achieved when the target exactly equals current average income", () => {
    const result = calculateIncomeGap({ targetMonthlyIncomeCents: 3500000, averageMonthlyIncomeCents: 3500000 });
    expect(result.achieved).toBe(true);
    expect(result.gapCents).toBe(0);
  });

  it("reports hasTarget=false and a null gap when no target is set", () => {
    const result = calculateIncomeGap({ targetMonthlyIncomeCents: null, averageMonthlyIncomeCents: 3500000 });
    expect(result.hasTarget).toBe(false);
    expect(result.gapCents).toBeNull();
    expect(result.achieved).toBe(false);
  });

  it("handles zero current income against a real target", () => {
    const result = calculateIncomeGap({ targetMonthlyIncomeCents: 2000000, averageMonthlyIncomeCents: 0 });
    expect(result.gapCents).toBe(2000000);
    expect(result.achieved).toBe(false);
  });
});
