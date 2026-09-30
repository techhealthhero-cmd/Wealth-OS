import type { EarnStageFacts, IncomeReliability } from "@/lib/earn/types";

/**
 * Earn diagnostic — 8 questions, one per screen. Pure definitions plus the
 * deterministic mapping from answers to Earn stage facts. Copy lives in the
 * locale files under `earn.v2.diagnostic.*`; nothing here is user-facing text.
 */
export const DIAGNOSTIC_RULES_VERSION = "earn-diagnostic-v1";

export const INCOME_SITUATIONS = ["none", "irregular", "salary", "freelance", "business", "investment"] as const;
export const RESOURCES = ["smartphone", "computer", "internet", "transport", "workspace", "time"] as const;
export const WORK_PREFERENCES = ["people", "digital", "creative", "hands_on", "teaching", "analysis", "not_sure"] as const;
export const ABILITIES = [
  "writing", "design", "tech", "languages", "sales", "teaching", "cooking", "driving", "crafts", "accounting", "social_media", "none",
] as const;
export const PRIORITIES = [
  "quick_money", "stable_job", "increase_income", "build_skills", "build_business", "long_term_wealth",
] as const;

/** Bucketed answers (people rarely know exact figures); stored as representative numbers. */
export const HOURS_BUCKETS = [
  { key: "under_5", hours: 3 },
  { key: "5_10", hours: 8 },
  { key: "10_20", hours: 15 },
  { key: "over_20", hours: 25 },
] as const;

export const CAPITAL_BUCKETS = [
  { key: "none", minor: 0 },
  { key: "under_1000", minor: 50_000 },
  { key: "1000_5000", minor: 300_000 },
  { key: "5000_20000", minor: 1_200_000 },
  { key: "over_20000", minor: 2_500_000 },
] as const;

export type IncomeSituation = (typeof INCOME_SITUATIONS)[number];
export type Resource = (typeof RESOURCES)[number];
export type WorkPreference = (typeof WORK_PREFERENCES)[number];
export type Ability = (typeof ABILITIES)[number];
export type Priority = (typeof PRIORITIES)[number];

export const DIAGNOSTIC_STEPS = [
  "income",
  "expenses",
  "resources",
  "preferences",
  "abilities",
  "time",
  "capital",
  "priority",
] as const;
export type DiagnosticStep = (typeof DIAGNOSTIC_STEPS)[number];

export interface DiagnosticAnswers {
  incomeSituation: IncomeSituation;
  /** Monthly income in minor units (satang); 0 when there is none. */
  monthlyIncomeMinor: number;
  /** Only asked for freelance/business/investment income; null elsewhere. */
  incomeIsSteady: boolean | null;
  essentialExpensesMinor: number;
  availableResources: Resource[];
  workPreferences: WorkPreference[];
  existingAbilities: Ability[];
  availableHoursPerWeek: number;
  startingCapitalMinor: number;
  startingCapitalCurrency: string;
  currentPriority: Priority;
}

/** Salary counts as reliable; irregular never does; self-employment only when the user says it is steady. */
export function deriveIncomeReliability(answers: Pick<DiagnosticAnswers, "incomeSituation" | "monthlyIncomeMinor" | "incomeIsSteady">): IncomeReliability {
  if (answers.incomeSituation === "none" || answers.monthlyIncomeMinor <= 0) return "none";
  if (answers.incomeSituation === "salary") return "reliable";
  if (answers.incomeSituation === "irregular") return "unreliable";
  return answers.incomeIsSteady === true ? "reliable" : "unreliable";
}

/**
 * Months of essential expenses the user's emergency fund covers, or null
 * when unknown — never 0 by default, because "no data" is not "no buffer".
 */
export function calculateBufferMonths(emergencyFundMinor: number | null, essentialExpensesMinor: number): number | null {
  if (emergencyFundMinor === null || essentialExpensesMinor <= 0) return null;
  return Math.floor((Math.max(0, emergencyFundMinor) / essentialExpensesMinor) * 10) / 10;
}

/**
 * Stage facts from a completed diagnostic. Self-reported figures are marked
 * as such; repeatability and financial-independence evidence can never come
 * from a questionnaire, so they are always false here.
 */
export function deriveStageFacts(answers: DiagnosticAnswers, emergencyFundMinor: number | null): EarnStageFacts {
  const currency = answers.startingCapitalCurrency;
  return {
    hasCompletedAssessment: true,
    monthlyIncome: { amountMinor: Math.max(0, answers.monthlyIncomeMinor), currency, source: "self_report" },
    essentialExpenses: { amountMinor: Math.max(0, answers.essentialExpensesMinor), currency, source: "self_report" },
    incomeReliability: deriveIncomeReliability(answers),
    bufferMonths: calculateBufferMonths(emergencyFundMinor, answers.essentialExpensesMinor),
    hasRepeatableIncomeMechanism: false,
    hasFinancialIndependenceEvidence: false,
  };
}

/** Which diagnostic step a partially filled draft should resume at. */
export function firstIncompleteStep(draft: Partial<DiagnosticAnswers>): DiagnosticStep | null {
  if (!draft.incomeSituation || draft.monthlyIncomeMinor === undefined) return "income";
  if (draft.essentialExpensesMinor === undefined || draft.essentialExpensesMinor <= 0) return "expenses";
  if (!draft.availableResources) return "resources";
  if (!draft.workPreferences?.length) return "preferences";
  if (!draft.existingAbilities?.length) return "abilities";
  if (draft.availableHoursPerWeek === undefined) return "time";
  if (draft.startingCapitalMinor === undefined) return "capital";
  if (!draft.currentPriority) return "priority";
  return null;
}
