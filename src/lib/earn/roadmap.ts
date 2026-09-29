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
