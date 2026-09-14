import { describe, expect, it } from "vitest";

import { calculateLevel, calculateTotalXp, getXpReward, XP_REWARDS } from "@/lib/financial/xp";
import type { XPEventType } from "@/types/database";

describe("XP rewards — correct amounts, never for non-financial actions", () => {
  it("gives a fixed, correct reward per event type", () => {
    expect(getXpReward("first_budget_created")).toBe(50);
    expect(getXpReward("mission_completed")).toBe(20);
    expect(getXpReward("income_mission_completed")).toBe(20);
    expect(getXpReward("monthly_review_completed")).toBe(30);
    expect(getXpReward("goal_milestone")).toBe(25);
    expect(getXpReward("emergency_fund_milestone")).toBe(25);
    expect(getXpReward("debt_milestone")).toBe(25);
  });

  it("only defines rewards for meaningful financial actions — no spending, app-opening, or investment-activity event types exist", () => {
    const eventTypes = Object.keys(XP_REWARDS) as XPEventType[];
    expect(eventTypes).not.toContain("spend_money");
    expect(eventTypes).not.toContain("open_app");
    expect(eventTypes).not.toContain("daily_login");
    expect(eventTypes.every((type) => XP_REWARDS[type] > 0)).toBe(true);
  });
});

describe("calculateTotalXp — no duplicate counting beyond what's given", () => {
  it("sums a ledger of events", () => {
    expect(calculateTotalXp([{ xpAmount: 50 }, { xpAmount: 20 }, { xpAmount: 30 }])).toBe(100);
  });

  it("returns 0 for an empty ledger", () => {
    expect(calculateTotalXp([])).toBe(0);
  });

  it("reflects the ledger exactly — the same event appearing twice in the ledger is summed twice (dedup is the ledger-writer's job, e.g. awardXpOnce, not this pure function's)", () => {
    expect(calculateTotalXp([{ xpAmount: 20 }, { xpAmount: 20 }])).toBe(40);
  });
});

describe("calculateLevel — deterministic thresholds", () => {
  it("starts at level 1 with zero XP", () => {
    const result = calculateLevel(0);
    expect(result.level).toBe(1);
    expect(result.xpIntoLevel).toBe(0);
  });

  it("advances a level exactly at each threshold", () => {
    expect(calculateLevel(99).level).toBe(1);
    expect(calculateLevel(100).level).toBe(2);
    expect(calculateLevel(249).level).toBe(2);
    expect(calculateLevel(250).level).toBe(3);
  });

  it("computes progress percent toward the next level", () => {
    const result = calculateLevel(150); // level 2 starts at 100, next at 250 -> 50/150
    expect(result.level).toBe(2);
    expect(result.xpIntoLevel).toBe(50);
    expect(result.xpForNextLevel).toBe(150);
    expect(result.progressPercent).toBeCloseTo(33.33, 1);
  });

  it("caps at the max level with no further 'next level' target", () => {
    const result = calculateLevel(999999);
    expect(result.level).toBe(8);
    expect(result.xpForNextLevel).toBeNull();
    expect(result.progressPercent).toBe(100);
  });
});
