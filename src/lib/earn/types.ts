import type { EarnReasonCode } from "@/lib/earn/reason-codes";

export const EARN_STAGES = [
  "unknown",
  "survive",
  "cashflow",
  "stability",
  "grow",
  "scale",
  "freedom",
] as const;

export type EarnStage = (typeof EARN_STAGES)[number];
export type EarnStageConfidence = "sufficient" | "insufficient";

export const INCOME_PATH_TYPES = [
  "career",
  "freelance_service",
  "business_product",
  "investment",
] as const;

export type IncomePathType = (typeof INCOME_PATH_TYPES)[number];
export type IncomePathStatus = "planned" | "active" | "paused" | "completed" | "archived";
export type AssessmentStatus = "not_started" | "in_progress" | "completed";
export type FinancialFactSource = "financial_data" | "self_report";
export type MissionCategory =
  | "learn"
  | "build"
  | "search"
  | "contact"
  | "sell"
  | "deliver"
  | "improve"
  | "financial";
export type SkillEvidenceDimension = "learning" | "action" | "outcome";

export interface CurrencyAmountFact {
  /** Minor units, for example satang. Must not combine different currencies. */
  amountMinor: number;
  currency: string;
  source: FinancialFactSource;
}

export type IncomeReliability = "none" | "unreliable" | "reliable";

export interface EarnStageFacts {
  hasCompletedAssessment: boolean;
  monthlyIncome: CurrencyAmountFact | null;
  essentialExpenses: CurrencyAmountFact | null;
  incomeReliability: IncomeReliability | null;
  /** Null means resilience is not yet known, not zero. */
  bufferMonths: number | null;
  /** Requires verified repeatability evidence; XP and Rank never set this. */
  hasRepeatableIncomeMechanism: boolean;
  /** Conservative aggregate evidence, never a net-worth-only comparison. */
  hasFinancialIndependenceEvidence: boolean;
}

export interface EarnStageResult {
  stage: EarnStage;
  reasonCodes: EarnReasonCode[];
  rulesVersion: string;
  confidence: EarnStageConfidence;
}

export interface NextActionPath {
  id: string;
  status: IncomePathStatus;
  initialized: boolean;
}

export interface NextActionMission {
  id: string;
  pathId: string | null;
  projectId?: string | null;
  estimatedMinutes: number | null;
}

export interface PendingMissionResult extends NextActionMission {
  resultRequired: true;
  hasResult: false;
}

export interface UnrecordedIncomeSignal {
  pathId: string | null;
  projectId?: string | null;
}

export type NextActionKind =
  | "complete_diagnostic"
  | "choose_income_path"
  | "initialize_income_path"
  | "record_mission_result"
  | "continue_mission"
  | "record_income"
  | "improve_cashflow"
  | "build_resilience"
  | "grow_income"
  | "optimize_scale"
  | "review_freedom_plan";

export interface NextAction {
  actionKind: NextActionKind;
  titleKey: string;
  reasonKey: string;
  ctaKey: string;
  estimatedMinutes: number | null;
  pathId: string | null;
  projectId: string | null;
  missionId: string | null;
  rulesVersion: string;
}
export interface NextActionInput {
  assessmentStatus: AssessmentStatus;
  stage: EarnStageResult;
  activePaths: NextActionPath[];
  pendingMissionResults: PendingMissionResult[];
  activeMissions: NextActionMission[];
  unrecordedIncome: UnrecordedIncomeSignal[];
}

export interface NextActionResult {
  primary: NextAction;
  secondary: NextAction[];
  rulesVersion: string;
}
