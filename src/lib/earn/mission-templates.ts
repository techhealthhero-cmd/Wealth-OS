import { getRoadmapTemplate } from "@/lib/earn/roadmap";
import type { IncomePathType, MissionCategory } from "@/lib/earn/types";

/**
 * One concrete, real-world mission per roadmap step (V1). Copy lives in the
 * locales under `earn.v2.missions.<pathType>.<stepKey>`; the title/description
 * are rendered in the user's language when the mission row is created.
 *
 * `resultFields` define what a result records. Funnel fields are ordered
 * widest → narrowest ("contacted ≥ responded ≥ interested ≥ customers"), so a
 * result that claims more customers than people contacted is rejected
 * rather than stored. No field is ever filled in by the system.
 */
export const MISSION_TEMPLATES_VERSION = "earn-missions-v1";

export interface MissionTemplate {
  pathType: IncomePathType;
  stepKey: string;
  category: MissionCategory;
  estimatedMinutes: number;
  targetQuantity: number | null;
  resultRequired: boolean;
  /** Counted outcomes, widest first. Empty = completion alone is the result. */
  resultFields: string[];
  /** Finishing this step can mean money arrived — prompt to record real income. */
  mayProduceIncome: boolean;
}

type Row = [stepKey: string, category: MissionCategory, minutes: number, target: number | null, fields: string[], mayProduceIncome?: boolean];

const TABLE: Record<IncomePathType, Row[]> = {
  career: [
    ["foundation", "learn", 30, null, []],
    ["skill_growth", "learn", 45, null, []],
    ["evidence", "build", 45, 3, ["achievements"]],
    ["performance", "improve", 30, null, []],
    ["compensation_review", "contact", 30, null, ["conversations", "raises"], true],
    ["market_check", "search", 45, 3, ["applications", "interviews", "offers"]],
  ],
  freelance_service: [
    ["foundation", "learn", 30, null, []],
    ["proof_of_work", "build", 90, 1, ["samples"]],
    ["find_leads", "search", 30, 5, ["contacted", "responses", "interested"]],
    ["proposal", "sell", 30, 1, ["proposals", "accepted"]],
    ["delivery", "deliver", 60, null, ["delivered"]],
    ["first_payment", "financial", 10, null, ["payments"], true],
    ["repeat", "contact", 30, 3, ["contacted", "repeat_customers"], true],
    ["raise_value", "improve", 30, null, ["quotes_sent", "accepted"], true],
  ],
  business_product: [
    ["problem", "search", 30, null, []],
    ["validation", "contact", 60, 5, ["interviewed", "interested", "would_pay"]],
    ["offer", "build", 60, null, []],
    ["first_sale", "sell", 45, null, ["offers_shown", "customers"], true],
    ["delivery", "deliver", 60, null, ["delivered"]],
    ["repeatability", "improve", 30, null, ["repeat_customers"], true],
    ["systemize", "build", 60, null, []],
    ["scale", "improve", 45, null, ["new_customers"], true],
  ],
  investment: [
    ["foundation", "learn", 20, null, []],
    ["goal", "financial", 15, null, []],
    ["time_horizon", "learn", 15, null, []],
    ["risk_understanding", "learn", 30, null, []],
    ["allocation_plan", "financial", 30, null, []],
    ["contribution", "financial", 10, null, []],
    ["review", "improve", 20, null, []],
  ],
};

export function getMissionTemplate(pathType: IncomePathType, stepKey: string): MissionTemplate | null {
  const row = TABLE[pathType].find(([key]) => key === stepKey);
  if (!row) return null;
  const [key, category, minutes, target, fields, mayProduceIncome = false] = row;
  return {
    pathType,
    stepKey: key,
    category,
    estimatedMinutes: minutes,
    targetQuantity: target,
    resultRequired: fields.length > 0,
    resultFields: [...fields],
    mayProduceIncome,
  };
}

/** Every roadmap step has exactly one template (kept in sync by tests). */
export function listMissionTemplates(pathType: IncomePathType): MissionTemplate[] {
  return getRoadmapTemplate(pathType).steps.map((s) => getMissionTemplate(pathType, s.key)!).filter(Boolean);
}

export const EXPERIMENT_DECISIONS = ["continue", "adjust", "pause", "switch"] as const;
export type ExperimentDecision = (typeof EXPERIMENT_DECISIONS)[number];

export interface MissionResultInput {
  counts: Record<string, number>;
  decision: ExperimentDecision | null;
  notes: string | null;
}

export type MissionResultError = "unknown_field" | "invalid_count" | "funnel_order";

/**
 * Validates a result against its template: only the template's fields,
 * whole non-negative numbers, and a funnel that never widens.
 */
export function validateMissionResult(template: MissionTemplate, input: MissionResultInput): MissionResultError | null {
  for (const [key, value] of Object.entries(input.counts)) {
    if (!template.resultFields.includes(key)) return "unknown_field";
    if (!Number.isInteger(value) || value < 0 || value > 100_000) return "invalid_count";
  }
  const values = template.resultFields.map((f) => input.counts[f]).filter((v): v is number => v !== undefined);
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) return "funnel_order";
  }
  return null;
}

/** Positive signal = the narrowest funnel stage recorded something (a customer, an offer, a payment). */
export function resultHasPositiveOutcome(template: MissionTemplate, counts: Record<string, number>): boolean {
  const last = template.resultFields[template.resultFields.length - 1];
  return last !== undefined && (counts[last] ?? 0) > 0;
}
