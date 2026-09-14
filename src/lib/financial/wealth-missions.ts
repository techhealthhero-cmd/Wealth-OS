/**
 * Wealth Missions — deterministic, template-driven generation (Day 6
 * STEP 2/10). Every candidate is produced from real, already-computed
 * system data (Priority Engine, Wealth Score, Income Engine, Goals,
 * Emergency Fund, Debt Planner, Budget) — never invented, and AI may only
 * reword a mission's explanation, never decide whether one applies.
 */

import type { ImpactLevel, MissionRelatedDomain, WealthMissionType } from "@/types/database";

export interface WealthMissionInputs {
  hasBudget: boolean;
  trackingDaysStreak: number;
  emergencyFundMonthsProtected: number;
  emergencyFundTargetMonths: number;
  hasEmergencyFundSetUp: boolean;
  currentMonthSavingsCents: number;
  hasDebt: boolean;
  pendingSubscriptionCount: number;
  hasCompletedReviewThisMonth: boolean;
  hasActiveGoals: boolean;
  activeIncomeSourceCount: number;
  savingsRatePercent: number;
  hasActiveIncomeMission: boolean;
}

export interface WealthMissionCandidate {
  /** Stable key used for i18n lookup (`missions.wealth.templates.<key>.*`) and de-duplication — never invented display text. */
  templateKey: string;
  missionType: WealthMissionType;
  relatedDomain: MissionRelatedDomain;
  targetQuantity: number | null;
  progressQuantity: number;
  impactLevel: ImpactLevel;
}

const TRACKING_DAYS_TARGET = 7;
const SAVE_THIS_MONTH_TARGET_CENTS = 100_000; // ฿1,000, per the task's own example
const EXTRA_DEBT_PAYMENT_TARGET_CENTS = 50_000; // ฿500, per the task's own example
const LOW_SAVINGS_RATE_THRESHOLD_PERCENT = 10;
const MIN_INCOME_SOURCES_TARGET = 2;

/**
 * Returns every mission whose condition currently holds. The caller
 * (`src/features/engagement/actions.ts`) is responsible for not
 * re-inserting a duplicate for a `templateKey` the user already has active.
 */
export function generateWealthMissionCandidates(inputs: WealthMissionInputs): WealthMissionCandidate[] {
  const candidates: WealthMissionCandidate[] = [];

  if (!inputs.hasBudget) {
    candidates.push({
      templateKey: "create_first_budget",
      missionType: "budgeting",
      relatedDomain: "budget",
      targetQuantity: null,
      progressQuantity: 0,
      impactLevel: "high",
    });
  }

  if (inputs.trackingDaysStreak < TRACKING_DAYS_TARGET) {
    candidates.push({
      templateKey: "log_expenses_7_days",
      missionType: "tracking",
      relatedDomain: "manual",
      targetQuantity: TRACKING_DAYS_TARGET,
      progressQuantity: inputs.trackingDaysStreak,
      impactLevel: "medium",
    });
  }

  if (inputs.hasEmergencyFundSetUp && inputs.emergencyFundMonthsProtected < 1) {
    candidates.push({
      templateKey: "build_one_month_emergency_fund",
      missionType: "emergency_fund",
      relatedDomain: "emergency_fund",
      targetQuantity: 1,
      progressQuantity: inputs.emergencyFundMonthsProtected,
      impactLevel: "high",
    });
  }

  if (inputs.currentMonthSavingsCents < SAVE_THIS_MONTH_TARGET_CENTS) {
    candidates.push({
      templateKey: "save_1000_this_month",
      missionType: "saving",
      relatedDomain: "priority_engine",
      targetQuantity: SAVE_THIS_MONTH_TARGET_CENTS,
      progressQuantity: Math.max(0, inputs.currentMonthSavingsCents),
      impactLevel: "medium",
    });
  }

  if (inputs.hasDebt) {
    candidates.push({
      templateKey: "extra_debt_payment",
      missionType: "debt",
      relatedDomain: "debt_planner",
      targetQuantity: EXTRA_DEBT_PAYMENT_TARGET_CENTS,
      progressQuantity: 0,
      impactLevel: "high",
    });
  }

  if (inputs.pendingSubscriptionCount > 0) {
    candidates.push({
      templateKey: "review_subscriptions",
      missionType: "planning",
      relatedDomain: "manual",
      targetQuantity: null,
      progressQuantity: 0,
      impactLevel: "low",
    });
  }

  if (!inputs.hasCompletedReviewThisMonth) {
    candidates.push({
      templateKey: "complete_monthly_review",
      missionType: "review",
      relatedDomain: "manual",
      targetQuantity: null,
      progressQuantity: 0,
      impactLevel: "medium",
    });
  }

  if (!inputs.hasActiveGoals) {
    candidates.push({
      templateKey: "add_financial_goals",
      missionType: "goals",
      relatedDomain: "goals",
      targetQuantity: null,
      progressQuantity: 0,
      impactLevel: "medium",
    });
  }

  if (inputs.activeIncomeSourceCount < MIN_INCOME_SOURCES_TARGET) {
    candidates.push({
      templateKey: "add_second_income_source",
      missionType: "income",
      relatedDomain: "income_engine",
      targetQuantity: MIN_INCOME_SOURCES_TARGET,
      progressQuantity: inputs.activeIncomeSourceCount,
      impactLevel: "low",
    });
  }

  if (inputs.savingsRatePercent < LOW_SAVINGS_RATE_THRESHOLD_PERCENT) {
    candidates.push({
      templateKey: "increase_savings_rate",
      missionType: "saving",
      relatedDomain: "priority_engine",
      targetQuantity: LOW_SAVINGS_RATE_THRESHOLD_PERCENT,
      progressQuantity: Math.max(0, inputs.savingsRatePercent),
      impactLevel: "medium",
    });
  }

  if (inputs.hasActiveIncomeMission) {
    candidates.push({
      templateKey: "complete_income_mission",
      missionType: "income",
      relatedDomain: "income_engine",
      targetQuantity: null,
      progressQuantity: 0,
      impactLevel: "low",
    });
  }

  return candidates;
}

/** True once a candidate's own progress has reached its target — the only automatic-completion rule (no target = never auto-completes; it needs an explicit user action). */
export function isMissionAutoCompletable(candidate: Pick<WealthMissionCandidate, "targetQuantity" | "progressQuantity">): boolean {
  return candidate.targetQuantity !== null && candidate.progressQuantity >= candidate.targetQuantity;
}
