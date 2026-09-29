import { describe, expect, it } from "vitest";

import { EARN_STAGE_RULES, calculateEarnStage } from "@/lib/earn/stage";
import type { EarnStageFacts } from "@/lib/earn/types";

const completeFacts: EarnStageFacts = {
  hasCompletedAssessment: true,
  monthlyIncome: { amountMinor: 5_000_000, currency: "THB", source: "financial_data" },
  essentialExpenses: { amountMinor: 3_000_000, currency: "THB", source: "financial_data" },
  incomeReliability: "reliable",
  bufferMonths: 3,
  hasRepeatableIncomeMechanism: false,
  hasFinancialIndependenceEvidence: false,
};

describe("EarnStage V1", () => {
  it("returns unknown when minimum diagnostic data is absent", () => {
    expect(calculateEarnStage({
      ...completeFacts,
      hasCompletedAssessment: false,
      monthlyIncome: null,
      essentialExpenses: null,
      incomeReliability: null,
    })).toEqual({
      stage: "unknown",
      reasonCodes: ["diagnostic_incomplete"],
      rulesVersion: EARN_STAGE_RULES.version,
      confidence: "insufficient",
    });
  });

  it("does not treat a zero essential-expense answer as a stable baseline", () => {
    const result = calculateEarnStage({
      ...completeFacts,
      monthlyIncome: { ...completeFacts.monthlyIncome!, amountMinor: 0 },
      essentialExpenses: { ...completeFacts.essentialExpenses!, amountMinor: 0 },
    });
    expect(result.stage).toBe("unknown");
    expect(result.reasonCodes).toEqual(["missing_essential_expenses"]);
  });

  it("classifies no income with essential expenses as survive", () => {
    const result = calculateEarnStage({
      ...completeFacts,
      monthlyIncome: { ...completeFacts.monthlyIncome!, amountMinor: 0 },
      incomeReliability: "none",
    });
    expect(result.stage).toBe("survive");
    expect(result.reasonCodes).toEqual(["no_income_for_basic_needs"]);
  });

  it("classifies income below essential expenses as cashflow", () => {
    const result = calculateEarnStage({
      ...completeFacts,
      monthlyIncome: { ...completeFacts.monthlyIncome!, amountMinor: 2_999_999 },
    });
    expect(result.stage).toBe("cashflow");
    expect(result.reasonCodes).toEqual(["income_below_essential_expenses"]);
  });

  it("classifies unreliable covering income as cashflow", () => {
    const result = calculateEarnStage({ ...completeFacts, incomeReliability: "unreliable" });
    expect(result.stage).toBe("cashflow");
    expect(result.reasonCodes).toEqual(["income_not_reliable"]);
  });

  it("classifies covered essentials with insufficient resilience as stability", () => {
    const result = calculateEarnStage({ ...completeFacts, bufferMonths: 2.99 });
    expect(result.stage).toBe("stability");
    expect(result.reasonCodes).toEqual(["essential_expenses_covered", "buffer_below_policy_minimum"]);
  });

  it("does not aggregate mismatched currencies", () => {
    const result = calculateEarnStage({
      ...completeFacts,
      essentialExpenses: { ...completeFacts.essentialExpenses!, currency: "USD" },
    });
    expect(result.stage).toBe("unknown");
    expect(result.reasonCodes).toEqual(["currency_mismatch"]);
  });

  it("uses explicit evidence gates for grow, scale and freedom", () => {
    expect(calculateEarnStage(completeFacts).stage).toBe("grow");
    expect(calculateEarnStage({ ...completeFacts, hasRepeatableIncomeMechanism: true }).stage).toBe("scale");
    expect(calculateEarnStage({
      ...completeFacts,
      hasRepeatableIncomeMechanism: true,
      hasFinancialIndependenceEvidence: true,
    }).stage).toBe("freedom");
  });

  it("is deterministic and keeps reason codes stable for identical facts", () => {
    expect(calculateEarnStage(completeFacts)).toEqual(calculateEarnStage({ ...completeFacts }));
  });
});
