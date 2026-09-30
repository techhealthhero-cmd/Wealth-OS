import type { IncomeModel, OpportunityDifficulty, TimeToFirstIncome } from "@/types/database";
import type { IncomePathType } from "@/lib/earn/types";

/**
 * Opportunities V2 — every catalog opportunity answers three questions:
 * WHAT is it (catalog copy), WHY might it be worth trying (named reasons),
 * and WHAT SMALL EXPERIMENT tests it cheaply. No numeric "match %" is shown:
 * the existing deterministic score is only bucketed into a plain label.
 * No job listings are invented — this is the fixed, curated catalog.
 */

export function opportunityPathType(model: IncomeModel): IncomePathType {
  return model === "product" ? "business_product" : "freelance_service";
}

export type OpportunityFit = "strong" | "worth_trying" | "later";

/** Buckets the existing deterministic 0–100 score into words; the number itself is never displayed. */
export function opportunityFit(score: number): OpportunityFit {
  if (score >= 70) return "strong";
  if (score >= 40) return "worth_trying";
  return "later";
}

export type OpportunityWhy = "skill_match" | "fast_income" | "easy_start" | "low_cost";

export function opportunityReasons(input: {
  matchedSkillCount: number;
  timeToFirstIncome: TimeToFirstIncome;
  difficulty: OpportunityDifficulty;
  startupCostMaxMinor: number;
}): OpportunityWhy[] {
  const out: OpportunityWhy[] = [];
  if (input.matchedSkillCount > 0) out.push("skill_match");
  if (input.timeToFirstIncome === "fast") out.push("fast_income");
  if (input.difficulty === "easy") out.push("easy_start");
  if (input.startupCostMaxMinor <= 100_000) out.push("low_cost");
  return out;
}

export type SmallExperiment = "show_sample_five" | "offer_trial_month" | "presell_five";

export function smallExperimentFor(model: IncomeModel): SmallExperiment {
  if (model === "product") return "presell_five";
  if (model === "recurring") return "offer_trial_month";
  return "show_sample_five";
}
