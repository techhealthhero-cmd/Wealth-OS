import { describe, expect, it } from "vitest";

import {
  calculatePlanProgress,
  calculatePlanScheduleStatus,
  calculateQuarterElapsedFraction,
  calculateYearElapsedFraction,
  distributeEvenly,
  monthToQuarter,
} from "@/lib/financial/money-year";

describe("calculatePlanProgress", () => {
  it("computes percent and remaining toward a target", () => {
    const progress = calculatePlanProgress(300000, 1000000);
    expect(progress.percent).toBeCloseTo(30);
    expect(progress.remainingCents).toBe(700000);
  });

  it("allows percent to exceed 100 once the target is surpassed", () => {
    const progress = calculatePlanProgress(1200000, 1000000);
    expect(progress.percent).toBeCloseTo(120);
    expect(progress.remainingCents).toBe(0);
  });

  it("edge case: target of 0 returns 0 percent, not Infinity/NaN", () => {
    const progress = calculatePlanProgress(500, 0);
    expect(progress.percent).toBe(0);
  });
});

describe("calculatePlanScheduleStatus", () => {
  it("returns on_track when progress roughly matches elapsed time", () => {
    expect(calculatePlanScheduleStatus(500000, 1000000, 0.5)).toBe("on_track");
  });

  it("returns ahead when progress well exceeds elapsed time", () => {
    expect(calculatePlanScheduleStatus(800000, 1000000, 0.3)).toBe("ahead");
  });

  it("returns behind when progress well trails elapsed time", () => {
    expect(calculatePlanScheduleStatus(100000, 1000000, 0.6)).toBe("behind");
  });

  it("edge case: zero target with zero actual is treated as on_track (0 vs 0 expected), not behind", () => {
    expect(calculatePlanScheduleStatus(0, 0, 0.5)).toBe("on_track");
  });
});

describe("calculateYearElapsedFraction", () => {
  it("returns 0 for a future year", () => {
    expect(calculateYearElapsedFraction(2099, new Date(2026, 0, 1))).toBe(0);
  });

  it("returns 1 for a past year", () => {
    expect(calculateYearElapsedFraction(2020, new Date(2026, 0, 1))).toBe(1);
  });

  it("returns roughly 0.5 at mid-year", () => {
    expect(calculateYearElapsedFraction(2026, new Date(2026, 6, 2))).toBeCloseTo(0.5, 1);
  });
});

describe("calculateQuarterElapsedFraction", () => {
  it("returns 0 before the quarter starts", () => {
    expect(calculateQuarterElapsedFraction(2026, 3, new Date(2026, 3, 1))).toBe(0);
  });

  it("returns 1 after the quarter ends", () => {
    expect(calculateQuarterElapsedFraction(2026, 1, new Date(2026, 6, 1))).toBe(1);
  });

  it("returns roughly 0.5 mid-quarter", () => {
    expect(calculateQuarterElapsedFraction(2026, 1, new Date(2026, 1, 14))).toBeCloseTo(0.5, 1);
  });
});

describe("distributeEvenly", () => {
  it("splits evenly when it divides cleanly", () => {
    expect(distributeEvenly(1200, 4)).toEqual([300, 300, 300, 300]);
  });

  it("distributes the remainder to the first buckets, and the total sums back exactly", () => {
    const parts = distributeEvenly(1000, 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });

  it("edge case: 0 parts returns an empty array", () => {
    expect(distributeEvenly(1000, 0)).toEqual([]);
  });
});

describe("monthToQuarter", () => {
  it("maps January (index 0) to Q1", () => {
    expect(monthToQuarter(0)).toBe(1);
  });

  it("maps December (index 11) to Q4", () => {
    expect(monthToQuarter(11)).toBe(4);
  });

  it("maps July (index 6) to Q3", () => {
    expect(monthToQuarter(6)).toBe(3);
  });
});
