import { describe, expect, it } from "vitest";

import {
  calculateAmountRemaining,
  calculateGoalProgress,
  calculateGoalScheduleStatus,
  calculateProjectedCompletionDate,
  calculateRequiredMonthlyContribution,
} from "@/lib/financial/goals";

describe("calculateGoalProgress", () => {
  it("computes a percentage of target reached", () => {
    expect(calculateGoalProgress(250000, 1000000)).toBeCloseTo(25);
  });

  it("caps at 100 when current exceeds target (already achieved)", () => {
    expect(calculateGoalProgress(1500000, 1000000)).toBe(100);
  });

  it("edge case: target of 0 returns 0, not Infinity/NaN", () => {
    expect(calculateGoalProgress(1000, 0)).toBe(0);
  });

  it("edge case: zero current amount", () => {
    expect(calculateGoalProgress(0, 1000000)).toBe(0);
  });
});

describe("calculateAmountRemaining", () => {
  it("returns the gap to target", () => {
    expect(calculateAmountRemaining(300000, 1000000)).toBe(700000);
  });

  it("returns 0, not negative, once the target is exceeded", () => {
    expect(calculateAmountRemaining(1200000, 1000000)).toBe(0);
  });
});

describe("calculateRequiredMonthlyContribution", () => {
  const today = new Date("2026-01-01T00:00:00Z");

  it("spreads the remaining amount evenly across the months until the target date", () => {
    const targetDate = new Date("2026-07-01T00:00:00Z");
    const required = calculateRequiredMonthlyContribution(0, 600000, targetDate, today);
    expect(required).not.toBeNull();
    expect(required!).toBeGreaterThan(90000);
    expect(required!).toBeLessThan(110000);
  });

  it("returns 0 once the goal is already achieved", () => {
    expect(calculateRequiredMonthlyContribution(1000000, 1000000, new Date("2026-07-01"), today)).toBe(0);
  });

  it("edge case: no target date returns null (can't compute a required monthly rate)", () => {
    expect(calculateRequiredMonthlyContribution(0, 500000, null, today)).toBeNull();
  });

  it("edge case: target date has already passed returns null", () => {
    const pastDate = new Date("2025-01-01T00:00:00Z");
    expect(calculateRequiredMonthlyContribution(0, 500000, pastDate, today)).toBeNull();
  });
});

describe("calculateProjectedCompletionDate", () => {
  const today = new Date("2026-01-01T00:00:00Z");

  it("projects a future date based on a flat monthly contribution", () => {
    const projected = calculateProjectedCompletionDate(0, 500000, 100000, today);
    expect(projected).not.toBeNull();
    expect(projected!.getTime()).toBeGreaterThan(today.getTime());
  });

  it("returns today when already achieved", () => {
    const projected = calculateProjectedCompletionDate(1000000, 1000000, 0, today);
    expect(projected).toEqual(today);
  });

  it("edge case: zero contribution and not yet achieved returns null", () => {
    expect(calculateProjectedCompletionDate(0, 500000, 0, today)).toBeNull();
  });

  it("edge case: month-end overflow does not skip into the following month", () => {
    // Jan 31 + 1 month must clamp to Feb 28/29, never overflow to March.
    const jan31 = new Date("2026-01-31T00:00:00");
    const projected = calculateProjectedCompletionDate(0, 100000, 100000, jan31);
    expect(projected).not.toBeNull();
    expect(projected!.getMonth()).toBe(1); // February (0-indexed)
  });
});

describe("calculateGoalScheduleStatus", () => {
  const today = new Date("2026-01-01T00:00:00Z");

  it("returns achieved once current >= target, regardless of date", () => {
    const pastDate = new Date("2025-01-01T00:00:00Z");
    expect(calculateGoalScheduleStatus(1000000, 1000000, pastDate, 0, today)).toBe("achieved");
  });

  it("returns unknown when there's no target date to compare against", () => {
    expect(calculateGoalScheduleStatus(100000, 1000000, null, 50000, today)).toBe("unknown");
  });

  it("returns unknown when there's no contribution to project from and it isn't achieved", () => {
    const farFuture = new Date("2030-01-01T00:00:00Z");
    expect(calculateGoalScheduleStatus(0, 1000000, farFuture, 0, today)).toBe("unknown");
  });

  it("returns ahead when projected completion is well before the target date", () => {
    const farFuture = new Date("2030-01-01T00:00:00Z");
    expect(calculateGoalScheduleStatus(0, 100000, farFuture, 100000, today)).toBe("ahead");
  });

  it("returns behind when the target date has effectively already passed relative to the projection", () => {
    const nearDate = new Date("2026-02-01T00:00:00Z");
    expect(calculateGoalScheduleStatus(0, 10000000, nearDate, 10000, today)).toBe("behind");
  });
});
