import { describe, expect, it } from "vitest";

import { generateWealthMissionCandidates, isMissionAutoCompletable, type WealthMissionInputs } from "@/lib/financial/wealth-missions";

const healthy: WealthMissionInputs = {
  hasBudget: true,
  trackingDaysStreak: 10,
  emergencyFundMonthsProtected: 6,
  emergencyFundTargetMonths: 6,
  hasEmergencyFundSetUp: true,
  currentMonthSavingsCents: 200_000,
  hasDebt: false,
  pendingSubscriptionCount: 0,
  hasCompletedReviewThisMonth: true,
  hasActiveGoals: true,
  activeIncomeSourceCount: 2,
  savingsRatePercent: 25,
  hasActiveIncomeMission: false,
};

describe("generateWealthMissionCandidates — mission generation", () => {
  it("generates no missions when everything is already healthy", () => {
    expect(generateWealthMissionCandidates(healthy)).toEqual([]);
  });

  it("suggests creating a budget only when the user has none", () => {
    const candidates = generateWealthMissionCandidates({ ...healthy, hasBudget: false });
    expect(candidates.some((c) => c.templateKey === "create_first_budget")).toBe(true);
  });

  it("suggests logging expenses for 7 days when the tracking streak is short", () => {
    const candidates = generateWealthMissionCandidates({ ...healthy, trackingDaysStreak: 2 });
    const mission = candidates.find((c) => c.templateKey === "log_expenses_7_days");
    expect(mission).toBeTruthy();
    expect(mission?.targetQuantity).toBe(7);
    expect(mission?.progressQuantity).toBe(2);
  });

  it("suggests an extra debt payment only when the user actually has debt", () => {
    expect(generateWealthMissionCandidates({ ...healthy, hasDebt: false }).some((c) => c.templateKey === "extra_debt_payment")).toBe(false);
    expect(generateWealthMissionCandidates({ ...healthy, hasDebt: true }).some((c) => c.templateKey === "extra_debt_payment")).toBe(true);
  });

  it("suggests reviewing subscriptions only when there are pending detected subscriptions", () => {
    expect(generateWealthMissionCandidates({ ...healthy, pendingSubscriptionCount: 0 }).some((c) => c.templateKey === "review_subscriptions")).toBe(
      false
    );
    expect(generateWealthMissionCandidates({ ...healthy, pendingSubscriptionCount: 2 }).some((c) => c.templateKey === "review_subscriptions")).toBe(
      true
    );
  });

  it("suggests adding a second income source until the user has at least two active sources", () => {
    const candidates = generateWealthMissionCandidates({ ...healthy, activeIncomeSourceCount: 1 });
    const mission = candidates.find((c) => c.templateKey === "add_second_income_source");
    expect(mission?.targetQuantity).toBe(2);
    expect(mission?.progressQuantity).toBe(1);
  });

  it("suggests increasing savings rate only below the 10% threshold", () => {
    expect(generateWealthMissionCandidates({ ...healthy, savingsRatePercent: 15 }).some((c) => c.templateKey === "increase_savings_rate")).toBe(
      false
    );
    expect(generateWealthMissionCandidates({ ...healthy, savingsRatePercent: 5 }).some((c) => c.templateKey === "increase_savings_rate")).toBe(true);
  });

  it("never generates vague missions — every candidate carries a specific, measurable template key", () => {
    const candidates = generateWealthMissionCandidates({
      ...healthy,
      hasBudget: false,
      trackingDaysStreak: 0,
      hasDebt: true,
      savingsRatePercent: 2,
    });
    for (const c of candidates) {
      expect(c.templateKey).not.toBe("");
      expect(c.templateKey).not.toMatch(/be better|work harder/i);
    }
  });
});

describe("isMissionAutoCompletable — automatic completion rules", () => {
  it("is completable once progress reaches the numeric target", () => {
    expect(isMissionAutoCompletable({ targetQuantity: 7, progressQuantity: 7 })).toBe(true);
    expect(isMissionAutoCompletable({ targetQuantity: 7, progressQuantity: 8 })).toBe(true);
  });

  it("is not completable while progress is still below target", () => {
    expect(isMissionAutoCompletable({ targetQuantity: 7, progressQuantity: 6 })).toBe(false);
  });

  it("is never auto-completable when there is no target — it requires an explicit user action", () => {
    expect(isMissionAutoCompletable({ targetQuantity: null, progressQuantity: 999 })).toBe(false);
  });
});
