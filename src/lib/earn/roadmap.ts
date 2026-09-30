import type { IncomePathType, MissionCategory } from "@/lib/earn/types";

export const ROADMAP_TEMPLATES_VERSION = "earn-roadmap-v1";

export interface RoadmapStepTemplate {
  key: string;
  order: number;
  missionCategories: MissionCategory[];
}

export interface RoadmapTemplate {
  pathType: IncomePathType;
  version: string;
  steps: RoadmapStepTemplate[];
  /** Product guardrail, consumed by future UI/generation layers. */
  guidanceMode: "career_progress" | "service_progress" | "business_progress" | "investment_planning_only";
}

function steps(definitions: Array<[string, MissionCategory[]]>): RoadmapStepTemplate[] {
  return definitions.map(([key, missionCategories], index) => ({ key, order: index + 1, missionCategories }));
}

export const ROADMAP_TEMPLATES: Record<IncomePathType, RoadmapTemplate> = {
  career: {
    pathType: "career",
    version: ROADMAP_TEMPLATES_VERSION,
    guidanceMode: "career_progress",
    steps: steps([
      ["foundation", ["learn"]],
      ["skill_growth", ["learn", "improve"]],
      ["evidence", ["build"]],
      ["performance", ["deliver", "improve"]],
      ["compensation_review", ["financial", "contact"]],
      ["market_check", ["search", "contact"]],
    ]),
  },
  freelance_service: {
    pathType: "freelance_service",
    version: ROADMAP_TEMPLATES_VERSION,
    guidanceMode: "service_progress",
    steps: steps([
      ["foundation", ["learn"]],
      ["proof_of_work", ["build"]],
      ["find_leads", ["search"]],
      ["proposal", ["contact", "sell"]],
      ["delivery", ["deliver"]],
      ["first_payment", ["financial"]],
      ["repeat", ["contact", "deliver"]],
      ["raise_value", ["improve", "sell"]],
    ]),
  },
  business_product: {
    pathType: "business_product",
    version: ROADMAP_TEMPLATES_VERSION,
    guidanceMode: "business_progress",
    steps: steps([
      ["problem", ["search"]],
      ["validation", ["contact"]],
      ["offer", ["build", "sell"]],
      ["first_sale", ["sell", "financial"]],
      ["delivery", ["deliver"]],
      ["repeatability", ["improve", "deliver"]],
      ["systemize", ["build", "improve"]],
      ["scale", ["improve"]],
    ]),
  },
  investment: {
    pathType: "investment",
    version: ROADMAP_TEMPLATES_VERSION,
    guidanceMode: "investment_planning_only",
    steps: steps([
      ["foundation", ["learn", "financial"]],
      ["goal", ["financial"]],
      ["time_horizon", ["learn", "financial"]],
      ["risk_understanding", ["learn"]],
      ["allocation_plan", ["learn", "financial"]],
      ["contribution", ["financial"]],
      ["review", ["improve", "financial"]],
    ]),
  },
};

export function getRoadmapTemplate(pathType: IncomePathType): RoadmapTemplate {
  const template = ROADMAP_TEMPLATES[pathType];
  return {
    ...template,
    steps: template.steps.map((step) => ({ ...step, missionCategories: [...step.missionCategories] })),
  };
}

export interface RoadmapProgress {
  total: number;
  /** 0-based index of the current step; equals `total` once every step is done. */
  currentIndex: number;
  currentStepKey: string | null;
  nextStepKey: string | null;
  completedStepKeys: string[];
  isComplete: boolean;
}

/**
 * Where a path is on its roadmap. `currentStepKey` null means either not
 * started (treated as the first step) or finished (`completed = true`). An
 * unknown key (template changed) falls back to the first step rather than
 * guessing progress.
 */
export function getRoadmapProgress(pathType: IncomePathType, currentStepKey: string | null, completed = false): RoadmapProgress {
  const keys = ROADMAP_TEMPLATES[pathType].steps.map((s) => s.key);
  if (completed) {
    return { total: keys.length, currentIndex: keys.length, currentStepKey: null, nextStepKey: null, completedStepKeys: keys, isComplete: true };
  }
  const found = currentStepKey ? keys.indexOf(currentStepKey) : -1;
  const index = found >= 0 ? found : 0;
  return {
    total: keys.length,
    currentIndex: index,
    currentStepKey: keys[index],
    nextStepKey: keys[index + 1] ?? null,
    completedStepKeys: keys.slice(0, index),
    isComplete: false,
  };
}

/** The step after `stepKey`, or null when it was the last one. */
export function getNextRoadmapStepKey(pathType: IncomePathType, stepKey: string): string | null {
  const keys = ROADMAP_TEMPLATES[pathType].steps.map((s) => s.key);
  const i = keys.indexOf(stepKey);
  return i >= 0 ? keys[i + 1] ?? null : null;
}
