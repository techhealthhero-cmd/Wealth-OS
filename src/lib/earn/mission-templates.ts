import { getRoadmapTemplate } from "@/lib/earn/roadmap";
import type { IncomePathType, MissionCategory } from "@/lib/earn/types";

export const MISSION_TEMPLATES_VERSION = "earn-missions-v2";

export type MissionResultKind = "simple" | "learning" | "customer_problem" | "customer_interview" | "artifact" | "count_funnel" | "income_outcome";
export type MissionEvidenceDimension = "learning" | "action" | "outcome" | "action_or_outcome" | null;
export interface MissionAnswerField { key: string; input: "short_text" | "long_text" | "url"; required: boolean; maxLength: number }
export interface MissionTemplate {
  pathType: IncomePathType; stepKey: string; category: MissionCategory; estimatedMinutes: number;
  targetQuantity: number | null; resultRequired: boolean; resultKind: MissionResultKind;
  resultFields: string[]; answerFields: MissionAnswerField[]; evidenceType: string | null;
  evidenceDimension: MissionEvidenceDimension; mayProduceIncome: boolean;
}

type Row = Omit<MissionTemplate, "pathType" | "resultRequired">;
const a = (key: string, input: MissionAnswerField["input"] = "long_text", required = true, maxLength = 1200): MissionAnswerField => ({ key, input, required, maxLength });
const row = (stepKey: string, category: MissionCategory, estimatedMinutes: number, resultKind: MissionResultKind, opts: Partial<Row> = {}): Row => ({
  stepKey, category, estimatedMinutes, resultKind, targetQuantity: null, resultFields: [], answerFields: [], evidenceType: resultKind === "simple" ? null : `mission_result:${stepKey}`,
  evidenceDimension: resultKind === "learning" ? "learning" : resultKind === "income_outcome" ? "outcome" : resultKind === "simple" ? null : "action_or_outcome",
  mayProduceIncome: resultKind === "income_outcome", ...opts,
});

const TABLE: Record<IncomePathType, Row[]> = {
  career: [
    row("foundation", "learn", 30, "simple"),
    row("skill_growth", "learn", 45, "learning", { answerFields: [a("learning"), a("application")] }),
    row("evidence", "build", 45, "artifact", { targetQuantity: 3, resultFields: ["achievements"], answerFields: [a("artifact_name", "short_text"), a("artifact_description")] }),
    row("performance", "improve", 30, "learning", { answerFields: [a("learning"), a("application")] }),
    row("compensation_review", "contact", 30, "income_outcome", { resultFields: ["conversations", "raises"] }),
    row("market_check", "search", 45, "count_funnel", { targetQuantity: 3, resultFields: ["applications", "interviews", "offers"] }),
  ],
  freelance_service: [
    row("foundation", "learn", 30, "simple"),
    row("proof_of_work", "build", 90, "artifact", { targetQuantity: 1, resultFields: ["samples"], answerFields: [a("artifact_name", "short_text"), a("artifact_url", "url", false, 500), a("artifact_description")] , evidenceDimension: "action"}),
    row("find_leads", "search", 30, "count_funnel", { targetQuantity: 5, resultFields: ["contacted", "responses", "interested"] }),
    row("proposal", "sell", 30, "count_funnel", { targetQuantity: 1, resultFields: ["proposals", "accepted"] }),
    row("delivery", "deliver", 60, "artifact", { targetQuantity: 1, resultFields: ["delivered"], answerFields: [a("artifact_name", "short_text"), a("artifact_description")] }),
    row("first_payment", "financial", 10, "income_outcome", { targetQuantity: 1, resultFields: ["payments"] }),
    row("repeat", "contact", 30, "income_outcome", { targetQuantity: 3, resultFields: ["contacted", "repeat_customers"] }),
    row("raise_value", "improve", 30, "income_outcome", { targetQuantity: 1, resultFields: ["quotes_sent", "accepted"] }),
  ],
  business_product: [
    row("problem", "search", 30, "customer_problem", { answerFields: [a("target_customer", "short_text"), a("customer_problem"), a("current_solution"), a("learning", "long_text", false)] , evidenceDimension: "action"}),
    row("validation", "contact", 60, "customer_interview", { targetQuantity: 5, resultFields: ["interviewed", "interested", "would_pay"], answerFields: [a("common_feedback", "long_text", false)] }),
    row("offer", "build", 60, "artifact", { targetQuantity: 1, resultFields: ["offers_built"], answerFields: [a("artifact_name", "short_text"), a("artifact_description")] }),
    row("first_sale", "sell", 45, "income_outcome", { targetQuantity: 1, resultFields: ["offers_shown", "customers"] }),
    row("delivery", "deliver", 60, "artifact", { targetQuantity: 1, resultFields: ["delivered"], answerFields: [a("artifact_name", "short_text"), a("artifact_description")] }),
    row("repeatability", "improve", 30, "income_outcome", { targetQuantity: 1, resultFields: ["repeat_customers"] }),
    row("systemize", "build", 60, "artifact", { targetQuantity: 1, resultFields: ["systems_built"], answerFields: [a("artifact_name", "short_text"), a("artifact_description")] }),
    row("scale", "improve", 45, "income_outcome", { targetQuantity: 1, resultFields: ["new_customers"] }),
  ],
  investment: [
    row("foundation", "learn", 20, "simple"),
    row("goal", "financial", 15, "simple"),
    row("time_horizon", "learn", 15, "simple"),
    row("risk_understanding", "learn", 30, "simple"),
    row("allocation_plan", "financial", 30, "simple"),
    row("contribution", "financial", 10, "simple"),
    row("review", "improve", 20, "simple"),
  ],
};

export function getMissionTemplate(pathType: IncomePathType, stepKey: string): MissionTemplate | null {
  const found = TABLE[pathType].find((r) => r.stepKey === stepKey);
  return found ? { ...found, pathType, resultRequired: found.resultKind !== "simple", resultFields: [...found.resultFields], answerFields: found.answerFields.map((f) => ({ ...f })) } : null;
}
export function listMissionTemplates(pathType: IncomePathType): MissionTemplate[] { return getRoadmapTemplate(pathType).steps.map((s) => getMissionTemplate(pathType, s.key)!).filter(Boolean); }

export const EXPERIMENT_DECISIONS = ["continue", "adjust", "pause", "switch"] as const;
export type ExperimentDecision = (typeof EXPERIMENT_DECISIONS)[number];
export interface MissionResultInput { counts: Record<string, number>; answers?: Record<string, string>; decision: ExperimentDecision | null; notes: string | null }
export type MissionResultError = "unknown_field" | "invalid_count" | "funnel_order" | "invalid_answer" | "invalid_url";

export function validateMissionResult(template: MissionTemplate, input: MissionResultInput): MissionResultError | null {
  for (const [key, value] of Object.entries(input.counts)) { if (!template.resultFields.includes(key)) return "unknown_field"; if (!Number.isInteger(value) || value < 0 || value > 100_000) return "invalid_count"; }
  for (const [key, value] of Object.entries(input.answers ?? {})) {
    const field = template.answerFields.find((f) => f.key === key); if (!field) return "unknown_field";
    if (typeof value !== "string" || value.trim().length > field.maxLength) return "invalid_answer";
    if (field.input === "url" && value.trim() && !/^https?:\/\//i.test(value.trim())) return "invalid_url";
  }
  const values = template.resultFields.map((f) => input.counts[f]).filter((v): v is number => v !== undefined);
  for (let i = 1; i < values.length; i++) if (values[i] > values[i - 1]) return "funnel_order";
  return null;
}
export function missionCompletionSatisfied(template: MissionTemplate, input: Pick<MissionResultInput, "counts" | "answers">): boolean {
  if (template.answerFields.some((f) => f.required && !input.answers?.[f.key]?.trim())) return false;
  if (template.targetQuantity !== null && template.resultFields.length > 0) return (input.counts[template.resultFields[0]] ?? 0) >= template.targetQuantity;
  return true;
}
export function resultHasPositiveOutcome(template: MissionTemplate, counts: Record<string, number>): boolean { const last = template.resultFields.at(-1); return last !== undefined && (counts[last] ?? 0) > 0; }
