import type { Ability, DiagnosticAnswers, Priority, Resource, WorkPreference } from "@/lib/earn/diagnostic";
import type { OpportunityReasonCode } from "@/lib/earn/reason-codes";
import type { EarnStage, IncomePathType } from "@/lib/earn/types";

/**
 * Recommended experiments — small, cheap, reversible first steps with a
 * real-world signal ("show one sample to five potential customers"), not
 * commitments ("learn web development for 6 months").
 *
 * Deterministic and explainable: an experiment is recommended because of
 * named reasons (reason codes), never a made-up "92% match". The catalog is
 * code (versioned), copy is in locales under `earn.v2.experiments.<key>`.
 */
export const RECOMMENDATION_RULES_VERSION = "earn-recommendations-v1";

export interface ExperimentDefinition {
  key: string;
  pathType: IncomePathType;
  /** Needs at least one of these (empty = no special resource). */
  anyResource: Resource[];
  preferences: WorkPreference[];
  abilities: Ability[];
  minHoursPerWeek: number;
  /** Up-front cost in minor units; compared with the user's starting capital. */
  costMinor: number;
  priorities: Priority[];
  /** Stages where this experiment is appropriate. */
  stages: EarnStage[];
  estimatedMinutes: number;
}

const EARLY: EarnStage[] = ["unknown", "survive", "cashflow", "stability", "grow", "scale", "freedom"];
const STABLE_PLUS: EarnStage[] = ["grow", "scale", "freedom"];

export const EXPERIMENTS: ExperimentDefinition[] = [
  {
    key: "apply_three_jobs", pathType: "career", anyResource: ["smartphone", "computer"],
    preferences: ["people", "analysis", "not_sure"], abilities: [], minHoursPerWeek: 3, costMinor: 0,
    priorities: ["quick_money", "stable_job"], stages: EARLY, estimatedMinutes: 45,
  },
  {
    key: "ask_for_raise_evidence", pathType: "career", anyResource: [],
    preferences: ["analysis", "people"], abilities: [], minHoursPerWeek: 3, costMinor: 0,
    priorities: ["increase_income", "build_skills"], stages: ["stability", "grow", "scale", "freedom"], estimatedMinutes: 30,
  },
  {
    key: "sample_and_show_five", pathType: "freelance_service", anyResource: ["computer", "smartphone"],
    preferences: ["digital", "creative"], abilities: ["design", "tech", "writing", "social_media"], minHoursPerWeek: 5, costMinor: 0,
    priorities: ["quick_money", "increase_income", "build_skills"], stages: EARLY, estimatedMinutes: 90,
  },
  {
    key: "local_service_five_neighbors", pathType: "freelance_service", anyResource: ["transport", "smartphone"],
    preferences: ["hands_on", "people"], abilities: ["cooking", "driving", "crafts"], minHoursPerWeek: 3, costMinor: 0,
    priorities: ["quick_money", "increase_income"], stages: EARLY, estimatedMinutes: 60,
  },
  {
    key: "tutoring_trial_lesson", pathType: "freelance_service", anyResource: ["smartphone", "computer"],
    preferences: ["teaching", "people"], abilities: ["teaching", "languages", "accounting"], minHoursPerWeek: 3, costMinor: 0,
    priorities: ["quick_money", "increase_income", "build_skills"], stages: EARLY, estimatedMinutes: 60,
  },
  {
    key: "presell_before_stock", pathType: "business_product", anyResource: ["smartphone"],
    preferences: ["creative", "people", "hands_on"], abilities: ["cooking", "crafts", "sales", "social_media"], minHoursPerWeek: 5, costMinor: 50_000,
    priorities: ["build_business", "increase_income", "quick_money"], stages: EARLY, estimatedMinutes: 60,
  },
  {
    key: "interview_five_customers", pathType: "business_product", anyResource: ["smartphone", "computer"],
    preferences: ["analysis", "people", "digital"], abilities: ["sales", "tech", "accounting"], minHoursPerWeek: 5, costMinor: 0,
    priorities: ["build_business", "long_term_wealth"], stages: ["stability", "grow", "scale", "freedom"], estimatedMinutes: 90,
  },
  {
    key: "investment_plan_basics", pathType: "investment", anyResource: [],
    preferences: ["analysis"], abilities: ["accounting"], minHoursPerWeek: 1, costMinor: 0,
    priorities: ["long_term_wealth"], stages: STABLE_PLUS, estimatedMinutes: 30,
  },
];

export interface RecommendedExperiment {
  key: string;
  pathType: IncomePathType;
  estimatedMinutes: number;
  reasonCodes: OpportunityReasonCode[];
}

/**
 * Up to `limit` experiments that fit the user's situation. Hard filters
 * first (stage, time, money, resources) — an experiment that needs money the
 * user doesn't have, or investing while basic needs aren't covered, is never
 * shown. Then ordered by how many reasons support it.
 */
export function recommendExperiments(answers: DiagnosticAnswers, stage: EarnStage, limit = 3): RecommendedExperiment[] {
  const scored: (RecommendedExperiment & { weight: number; order: number })[] = [];

  EXPERIMENTS.forEach((e, order) => {
    if (!e.stages.includes(stage)) return;
    if (answers.availableHoursPerWeek < e.minHoursPerWeek) return;
    if (e.costMinor > answers.startingCapitalMinor) return;
    if (e.anyResource.length > 0 && !e.anyResource.some((r) => answers.availableResources.includes(r))) return;

    const reasons: OpportunityReasonCode[] = [];
    if (e.abilities.some((a) => answers.existingAbilities.includes(a))) reasons.push("matches_existing_skill");
    if (e.preferences.some((p) => answers.workPreferences.includes(p))) reasons.push("matches_work_preference");
    if (e.anyResource.some((r) => answers.availableResources.includes(r))) reasons.push("uses_existing_resources");
    if (e.priorities.includes(answers.currentPriority)) reasons.push("supports_income_goal");
    if (e.costMinor === 0) reasons.push("low_starting_capital");
    if (answers.availableHoursPerWeek >= e.minHoursPerWeek) reasons.push("matches_available_time");

    // Skill/preference/goal fit matter more than "it's free".
    const weight =
      (reasons.includes("matches_existing_skill") ? 3 : 0) +
      (reasons.includes("matches_work_preference") ? 2 : 0) +
      (reasons.includes("supports_income_goal") ? 2 : 0) +
      (reasons.includes("uses_existing_resources") ? 1 : 0) +
      (reasons.includes("low_starting_capital") ? 1 : 0);
    scored.push({ key: e.key, pathType: e.pathType, estimatedMinutes: e.estimatedMinutes, reasonCodes: reasons, weight, order });
  });

  return scored
    .sort((a, b) => b.weight - a.weight || a.order - b.order)
    .slice(0, limit)
    .map(({ key, pathType, estimatedMinutes, reasonCodes }) => ({ key, pathType, estimatedMinutes, reasonCodes }));
}

export function getExperiment(key: string): ExperimentDefinition | null {
  return EXPERIMENTS.find((e) => e.key === key) ?? null;
}
