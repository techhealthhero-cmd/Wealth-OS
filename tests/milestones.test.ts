import { describe, expect, it } from "vitest";

import { MILESTONE_KEYS, calculateMilestones, longestDailyRun, type MilestoneInputs } from "@/lib/financial/milestones";

const EMPTY: MilestoneInputs = {
  transactionCount: 0,
  hasBudget: false,
  emergencyFundCurrentCents: 0,
  goals: [],
  liabilityBalancesCents: [],
  activeIncomeSourceTypes: [],
  transactionDates: [],
};

function days(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

describe("calculateMilestones", () => {
  it("a brand-new user has reached none", () => {
    const result = calculateMilestones(EMPTY);
    expect(MILESTONE_KEYS.every((k) => result[k] === false)).toBe(true);
  });

  it("each milestone lights up from its own real data", () => {
    const result = calculateMilestones({
      transactionCount: 1,
      hasBudget: true,
      emergencyFundCurrentCents: 100,
      goals: [{ currentCents: 5000, targetCents: 5000, completed: false }],
      liabilityBalancesCents: [12_000, 0],
      activeIncomeSourceTypes: ["salary", "freelance"],
      transactionDates: days(new Date(2026, 8, 1), 7),
    });
    expect(MILESTONE_KEYS.every((k) => result[k] === true)).toBe(true);
  });

  it("goal: a completed goal counts, a half-funded or zero-target one doesn't", () => {
    const goal = (currentCents: number, targetCents: number, completed = false) =>
      calculateMilestones({ ...EMPTY, goals: [{ currentCents, targetCents, completed }] })["goal-reached"];
    expect(goal(0, 0)).toBe(false);
    expect(goal(2500, 5000)).toBe(false);
    expect(goal(2500, 5000, true)).toBe(true);
  });

  it("debt: only a liability paid down to zero counts", () => {
    expect(calculateMilestones({ ...EMPTY, liabilityBalancesCents: [1] })["first-debt-paid"]).toBe(false);
    expect(calculateMilestones({ ...EMPTY, liabilityBalancesCents: [0] })["first-debt-paid"]).toBe(true);
  });

  it("side income: salary and bonus are not side income", () => {
    const side = (types: string[]) => calculateMilestones({ ...EMPTY, activeIncomeSourceTypes: types })["first-side-income"];
    expect(side(["salary", "bonus"])).toBe(false);
    expect(side(["side_hustle"])).toBe(true);
  });

  it("streak: needs 7 consecutive days, 6 is not enough", () => {
    expect(calculateMilestones({ ...EMPTY, transactionDates: days(new Date(2026, 8, 1), 6) })["saving-streak-7"]).toBe(false);
  });
});

describe("longestDailyRun", () => {
  it("counts the longest run, ignoring duplicates, order and month boundaries", () => {
    const dates = [...days(new Date(2026, 7, 29), 5), new Date(2026, 7, 30), new Date(2026, 8, 10)].reverse();
    expect(longestDailyRun(dates)).toBe(5); // Aug 29 – Sep 2
    expect(longestDailyRun([])).toBe(0);
  });
});
