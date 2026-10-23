import { describe, expect, it } from "vitest";

import { calculateYearlyBalance } from "@/lib/financial/yearly-balance";

describe("calculateYearlyBalance", () => {
  it("reports a surplus, its size relative to expenses, and pushes the meeting point right", () => {
    const result = calculateYearlyBalance(35_000_000, 32_200_000);
    expect(result.netCents).toBe(2_800_000);
    expect(result.status).toBe("surplus");
    expect(result.differencePercent).toBeCloseTo(8.6957, 3);
    // 2,800,000 / 35,000,000 * 150 = 12 → 62
    expect(result.meetingPointPercent).toBeCloseTo(62, 6);
  });

  it("reports a deficit relative to income and pushes the meeting point left", () => {
    const result = calculateYearlyBalance(35_000_000, 42_000_000);
    expect(result.netCents).toBe(-7_000_000);
    expect(result.status).toBe("deficit");
    expect(result.differencePercent).toBeCloseTo(20, 6);
    // -7,000,000 / 42,000,000 * 150 = -25 → 25
    expect(result.meetingPointPercent).toBeCloseTo(25, 6);
  });

  it("meets in the middle when income equals expenses", () => {
    const result = calculateYearlyBalance(1_000_000, 1_000_000);
    expect(result.status).toBe("even");
    expect(result.differencePercent).toBe(0);
    expect(result.meetingPointPercent).toBe(50);
  });

  it("clamps so neither bar disappears", () => {
    expect(calculateYearlyBalance(1_000_000, 0).meetingPointPercent).toBe(92);
    expect(calculateYearlyBalance(0, 1_000_000).meetingPointPercent).toBe(8);
  });

  it("has no ratio when the base is zero", () => {
    expect(calculateYearlyBalance(1_000_000, 0).differencePercent).toBeNull();
    expect(calculateYearlyBalance(0, 1_000_000).differencePercent).toBeNull();
    expect(calculateYearlyBalance(0, 0).differencePercent).toBeNull();
    expect(calculateYearlyBalance(0, 0).meetingPointPercent).toBe(50);
  });

  it("treats negative inputs (net refunds) as zero", () => {
    const result = calculateYearlyBalance(500_000, -20_000);
    expect(result.expensesCents).toBe(0);
    expect(result.netCents).toBe(500_000);
  });
});
