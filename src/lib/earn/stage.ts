import type { EarnReasonCode } from "@/lib/earn/reason-codes";
import type { EarnStageFacts, EarnStageResult } from "@/lib/earn/types";

export const EARN_STAGE_RULES = {
  version: "earn-stage-v1",
  /**
   * V1 reuses the product's existing conservative resilience convention of
   * three months. It is configuration, not a hidden score. Product policy
   * may revise it in a future rules version without rewriting history.
   */
  minimumBufferMonthsForGrowth: 3,
  /**
   * TODO(product-policy): define the exact evidence rollups that set these
   * upstream facts once Mission Results and Projects are implemented.
   * V1 intentionally refuses to infer them from XP, Rank or net worth alone.
   */
  repeatabilityGate: "explicit_evidence_required",
  freedomGate: "explicit_multi_factor_evidence_required",
} as const;

function unknown(...reasonCodes: EarnReasonCode[]): EarnStageResult {
  return {
    stage: "unknown",
    reasonCodes,
    rulesVersion: EARN_STAGE_RULES.version,
    confidence: "insufficient",
  };
}

/**
 * Earn-only progression. This deliberately does not import or map the global
 * financial life-stage engine. XP, Rank and self-reported skill proficiency
 * are not inputs.
 */
export function calculateEarnStage(facts: EarnStageFacts): EarnStageResult {
  if (!facts.hasCompletedAssessment) return unknown("diagnostic_incomplete");
  if (!facts.monthlyIncome) return unknown("missing_income_data");
  if (!facts.essentialExpenses) return unknown("missing_essential_expenses");
  if (!facts.incomeReliability) return unknown("missing_income_reliability");
  if (facts.monthlyIncome.currency !== facts.essentialExpenses.currency) {
    return unknown("currency_mismatch");
  }

  const income = Math.max(0, facts.monthlyIncome.amountMinor);
  const essential = Math.max(0, facts.essentialExpenses.amountMinor);

  // A reported zero cannot establish that basic needs are genuinely covered.
  // Stay unknown until a usable essential-expense baseline exists.
  if (essential === 0) return unknown("missing_essential_expenses");

  if (income === 0 && essential > 0) {
    return sufficient("survive", ["no_income_for_basic_needs"]);
  }

  if (income < essential) {
    return sufficient("cashflow", ["income_below_essential_expenses"]);
  }

  if (facts.incomeReliability !== "reliable") {
    return sufficient("cashflow", ["income_not_reliable"]);
  }

  if (facts.bufferMonths === null) {
    return sufficient("stability", ["essential_expenses_covered", "buffer_unknown"]);
  }

  if (facts.bufferMonths < EARN_STAGE_RULES.minimumBufferMonthsForGrowth) {
    return sufficient("stability", ["essential_expenses_covered", "buffer_below_policy_minimum"]);
  }

  if (facts.hasFinancialIndependenceEvidence) {
    return sufficient("freedom", ["essential_expenses_covered", "financial_independence_evidence"]);
  }

  if (facts.hasRepeatableIncomeMechanism) {
    return sufficient("scale", ["foundation_ready_for_growth", "repeatable_income_mechanism"]);
  }

  return sufficient("grow", ["foundation_ready_for_growth"]);
}

function sufficient(stage: EarnStageResult["stage"], reasonCodes: EarnReasonCode[]): EarnStageResult {
  return {
    stage,
    reasonCodes,
    rulesVersion: EARN_STAGE_RULES.version,
    confidence: "sufficient",
  };
}
