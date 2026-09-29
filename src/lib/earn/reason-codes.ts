/**
 * Stable, machine-readable reasons returned by the Earn rules engines.
 * UI copy belongs in the locale dictionaries; never render these values as
 * user-facing sentences.
 */
export const EARN_REASON_CODES = [
  "diagnostic_incomplete",
  "missing_income_data",
  "missing_essential_expenses",
  "missing_income_reliability",
  "currency_mismatch",
  "no_income_for_basic_needs",
  "income_below_essential_expenses",
  "income_not_reliable",
  "essential_expenses_covered",
  "buffer_unknown",
  "buffer_below_policy_minimum",
  "foundation_ready_for_growth",
  "repeatable_income_mechanism",
  "financial_independence_evidence",
  "income_path_missing",
  "income_path_not_initialized",
  "mission_result_pending",
  "mission_ready",
  "earned_income_not_recorded",
  "cashflow_needs_attention",
  "resilience_needs_attention",
  "earning_capacity_can_grow",
  "repeatable_income_can_scale",
  "freedom_plan_needs_review",
] as const;

export type EarnReasonCode = (typeof EARN_REASON_CODES)[number];

export const OPPORTUNITY_REASON_CODES = [
  "matches_existing_skill",
  "matches_available_time",
  "low_starting_capital",
  "matches_work_preference",
  "supports_income_goal",
] as const;

export type OpportunityReasonCode = (typeof OPPORTUNITY_REASON_CODES)[number];
