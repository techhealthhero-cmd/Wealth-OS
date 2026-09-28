import { describe, expect, it } from "vitest";

import {
  calculateIncomeRank,
  getIncomeMissionXpReward,
  INCOME_RANKS,
} from "@/lib/skills/income-rank";

describe("income builder rank", () => {
  it("rewards higher-value income outcomes more than preparation", () => {
    expect(getIncomeMissionXpReward("define_offer")).toBe(10);
    expect(getIncomeMissionXpReward("build_portfolio")).toBe(15);
    expect(getIncomeMissionXpReward("close_client")).toBe(40);
    expect(getIncomeMissionXpReward("ask_referral")).toBe(30);
  });

  it("advances at the published rank thresholds", () => {
    expect(calculateIncomeRank(0)).toMatchObject({ rank: 1, progressPercent: 0, xpToNextRank: 100 });
    expect(calculateIncomeRank(99).rank).toBe(1);
    expect(calculateIncomeRank(100)).toMatchObject({ rank: 2, xpIntoRank: 0, xpToNextRank: 150 });
    expect(calculateIncomeRank(500).rank).toBe(4);
    expect(calculateIncomeRank(2500)).toMatchObject({ rank: 7, progressPercent: 100, nextRank: null });
  });

  it("keeps thresholds ordered and normalizes invalid XP", () => {
    expect(INCOME_RANKS.map((rank) => rank.minimumXp)).toEqual([0, 100, 250, 500, 900, 1500, 2500]);
    expect(calculateIncomeRank(-20)).toMatchObject({ rank: 1, totalXp: 0 });
    expect(calculateIncomeRank(149.9)).toMatchObject({ rank: 2, totalXp: 149 });
  });
});
