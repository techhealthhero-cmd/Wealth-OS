import { describe, expect, it } from "vitest";

import { PLANS } from "@/lib/billing/plans";
import { COMPANIONS, COMPANION_SUGGESTION_KEYS, STARTER_COMPANION_ID, getCompanion } from "@/lib/companions/catalog";
import {
  findNewlyEarnedCompanionIds,
  getUnlockProgress,
  isCompanionAvailable,
  isUnlockRuleMet,
  resolveActiveCompanion,
  type CompanionUnlockFacts,
} from "@/lib/companions/unlock";
import { pickCompanionTip, type CompanionTipInput } from "@/lib/companions/tips";

const noProgress: CompanionUnlockFacts = {
  lastMonthBudget: null,
  emergencyFundMonthsProtected: 0,
  reviewedSubscriptionCount: 0,
  pendingSubscriptionCount: 0,
  recentDebtPaymentCount: 0,
};

const none = new Set<string>();

describe("companion catalog", () => {
  it("has unique ids, and every image lives in the companions library", () => {
    const ids = COMPANIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COMPANIONS) expect(c.image.startsWith("/companions/")).toBe(true);
  });

  it("spirits are never plan-gated (earned only); wizards always are", () => {
    for (const c of COMPANIONS) {
      if (c.kind === "spirit") expect(c.access.type).not.toBe("plan");
      if (c.kind === "wizard") expect(c.access.type).toBe("plan");
    }
  });
});

describe("unlock rules", () => {
  it("budget_month_kept needs a real budget last month with spending at or under it", () => {
    expect(isUnlockRuleMet("budget_month_kept", noProgress)).toBe(false);
    expect(
      isUnlockRuleMet("budget_month_kept", { ...noProgress, lastMonthBudget: { budgetCents: 0, spentCents: 0 } })
    ).toBe(false);
    expect(
      isUnlockRuleMet("budget_month_kept", { ...noProgress, lastMonthBudget: { budgetCents: 1000, spentCents: 1001 } })
    ).toBe(false);
    expect(
      isUnlockRuleMet("budget_month_kept", { ...noProgress, lastMonthBudget: { budgetCents: 1000, spentCents: 1000 } })
    ).toBe(true);
  });

  it("emergency_fund_one_month is relative to the user's own expenses (months), not a baht amount", () => {
    expect(isUnlockRuleMet("emergency_fund_one_month", { ...noProgress, emergencyFundMonthsProtected: 0.99 })).toBe(false);
    expect(isUnlockRuleMet("emergency_fund_one_month", { ...noProgress, emergencyFundMonthsProtected: 1 })).toBe(true);
    expect(getUnlockProgress("emergency_fund_one_month", { ...noProgress, emergencyFundMonthsProtected: 0.456 })).toEqual({
      current: 0.46,
      target: 1,
    });
    expect(getUnlockProgress("emergency_fund_one_month", { ...noProgress, emergencyFundMonthsProtected: 4 })).toEqual({
      current: 1,
      target: 1,
    });
  });

  it("money_leaks_handled: every detected subscription decided, or a recent debt payment", () => {
    expect(isUnlockRuleMet("money_leaks_handled", noProgress)).toBe(false);
    expect(
      isUnlockRuleMet("money_leaks_handled", { ...noProgress, reviewedSubscriptionCount: 2, pendingSubscriptionCount: 1 })
    ).toBe(false);
    expect(
      isUnlockRuleMet("money_leaks_handled", { ...noProgress, reviewedSubscriptionCount: 2, pendingSubscriptionCount: 0 })
    ).toBe(true);
    expect(isUnlockRuleMet("money_leaks_handled", { ...noProgress, recentDebtPaymentCount: 1 })).toBe(true);
  });

  it("findNewlyEarnedCompanionIds returns only progress spirits not already stored", () => {
    const facts: CompanionUnlockFacts = { ...noProgress, emergencyFundMonthsProtected: 2, recentDebtPaymentCount: 1 };
    expect(findNewlyEarnedCompanionIds(facts, none).sort()).toEqual(["spirit-hooded", "spirit-leaf"]);
    expect(findNewlyEarnedCompanionIds(facts, new Set(["spirit-leaf"]))).toEqual(["spirit-hooded"]);
    expect(findNewlyEarnedCompanionIds(noProgress, none)).toEqual([]);
  });
});

describe("availability and the active companion", () => {
  it("wizards follow the plan; spirits follow stored unlocks; the starter is always available", () => {
    const hat = getCompanion("wizard-hat")!;
    const proWizard = getCompanion("wizard-hooded")!;
    const leaf = getCompanion("spirit-leaf")!;
    expect(isCompanionAvailable(hat, none, PLANS.free.features)).toBe(false);
    expect(isCompanionAvailable(hat, none, PLANS.plus.features)).toBe(true);
    expect(isCompanionAvailable(proWizard, none, PLANS.plus.features)).toBe(false);
    expect(isCompanionAvailable(proWizard, none, PLANS.pro.features)).toBe(true);
    // Paying never unlocks a spirit.
    expect(isCompanionAvailable(leaf, none, PLANS.pro.features)).toBe(false);
    expect(isCompanionAvailable(leaf, new Set(["spirit-leaf"]), PLANS.free.features)).toBe(true);
    expect(isCompanionAvailable(getCompanion(STARTER_COMPANION_ID)!, none, PLANS.free.features)).toBe(true);
  });

  it("falls back to the starter for an unknown, unearned, or no-longer-entitled selection", () => {
    expect(resolveActiveCompanion(null, none, PLANS.free.features).id).toBe(STARTER_COMPANION_ID);
    expect(resolveActiveCompanion("nope", none, PLANS.pro.features).id).toBe(STARTER_COMPANION_ID);
    expect(resolveActiveCompanion("spirit-leaf", none, PLANS.pro.features).id).toBe(STARTER_COMPANION_ID);
    expect(resolveActiveCompanion("wizard-hat", none, PLANS.free.features).id).toBe(STARTER_COMPANION_ID);
    expect(resolveActiveCompanion("wizard-hat", none, PLANS.plus.features).id).toBe("wizard-hat");
    expect(resolveActiveCompanion("spirit-leaf", new Set(["spirit-leaf"]), PLANS.free.features).id).toBe("spirit-leaf");
  });

  it("presence (animation + tips) is Plus/Pro, never Free", () => {
    expect(PLANS.free.features.COMPANION_PRESENCE).toBe(false);
    expect(PLANS.plus.features.COMPANION_PRESENCE).toBe(true);
    expect(PLANS.pro.features.COMPANION_PRESENCE).toBe(true);
  });
});

describe("AI window suggestions", () => {
  it("every companion focus offers exactly 3 suggestions that exist in both languages", async () => {
    const th = (await import("@/i18n/locales/th.json")).default.aiCoach.suggestedPrompts as Record<string, string>;
    const en = (await import("@/i18n/locales/en.json")).default.aiCoach.suggestedPrompts as Record<string, string>;
    for (const c of COMPANIONS) {
      const keys = COMPANION_SUGGESTION_KEYS[c.focus];
      expect(new Set(keys).size).toBe(3);
      for (const key of keys) {
        expect(th[key], `th ${key}`).toBeTruthy();
        expect(en[key], `en ${key}`).toBeTruthy();
      }
    }
  });
});

describe("pickCompanionTip", () => {
  const input: CompanionTipInput = {
    priorityType: "no_emergency_fund",
    insightTypes: ["spending_increase"],
    pendingSubscriptionCount: 2,
    budgetStatus: "near_limit",
    emergencyFundMonthsProtected: 0.4,
    hasEmergencyFund: true,
  };

  it("each focus raises its own topic first", () => {
    expect(pickCompanionTip("saving", input)).toEqual({ kind: "priority", priorityType: "no_emergency_fund" });
    expect(pickCompanionTip("spending", input)).toEqual({ kind: "budget_near_limit" });
    expect(pickCompanionTip("debt", input)).toEqual({ kind: "subscriptions_pending", count: 2 });
    expect(pickCompanionTip("insights", input)).toEqual({ kind: "insight", insightType: "spending_increase", index: 0 });
  });

  it("overview takes the most important tip; an unmatched focus falls back to it", () => {
    expect(pickCompanionTip("overview", input)).toEqual({ kind: "priority", priorityType: "no_emergency_fund" });
    expect(pickCompanionTip("income", input)).toEqual({ kind: "priority", priorityType: "no_emergency_fund" });
  });

  it("says all good when there is genuinely nothing to raise", () => {
    expect(
      pickCompanionTip("spending", {
        priorityType: null,
        insightTypes: [],
        pendingSubscriptionCount: 0,
        budgetStatus: "healthy",
        emergencyFundMonthsProtected: 0,
        hasEmergencyFund: false,
      })
    ).toEqual({ kind: "all_good" });
  });
});
