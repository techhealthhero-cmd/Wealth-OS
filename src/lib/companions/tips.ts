/**
 * Picks the one tip a companion raises in its speech bubble. Pure and
 * deterministic: every candidate comes from data the app already computed
 * (Priority Engine, Insights, budget status, detected subscriptions) — the
 * companion's `focus` only decides which of those real facts it mentions
 * first. Nothing here invents a number.
 */
import type { CompanionFocus } from "./catalog";

export type TipPriorityType =
  | "negative_cash_flow"
  | "no_emergency_fund"
  | "high_interest_debt"
  | "low_savings_rate"
  | "missed_goal"
  | "no_investment_contribution"
  | "weak_income_growth"
  | "income_gap";

export type TipInsightType = "spending_increase" | "savings_rate_drop" | "debt_progress" | "goal_ahead" | "net_worth_growth";

export type CompanionTip =
  | { kind: "priority"; priorityType: string }
  | { kind: "insight"; insightType: TipInsightType; index: number }
  | { kind: "subscriptions_pending"; count: number }
  | { kind: "budget_over" }
  | { kind: "budget_near_limit" }
  | { kind: "no_budget" }
  | { kind: "emergency_fund_progress"; months: number }
  | { kind: "all_good" };

export interface CompanionTipInput {
  priorityType: string | null;
  insightTypes: TipInsightType[];
  pendingSubscriptionCount: number;
  budgetStatus: "healthy" | "near_limit" | "over_budget" | "no_budget" | null;
  emergencyFundMonthsProtected: number;
  hasEmergencyFund: boolean;
}

const PRIORITY_FOCUS: Record<TipPriorityType, CompanionFocus> = {
  negative_cash_flow: "spending",
  low_savings_rate: "saving",
  no_emergency_fund: "saving",
  high_interest_debt: "debt",
  missed_goal: "planning",
  no_investment_contribution: "planning",
  weak_income_growth: "income",
  income_gap: "income",
};

const INSIGHT_FOCUS: Record<TipInsightType, CompanionFocus> = {
  spending_increase: "spending",
  savings_rate_drop: "saving",
  debt_progress: "debt",
  goal_ahead: "planning",
  net_worth_growth: "overview",
};

interface Candidate {
  tip: CompanionTip;
  focus: CompanionFocus;
}

/** Every real tip available right now, most important first (Priority Engine order wins). */
export function buildTipCandidates(input: CompanionTipInput): Candidate[] {
  const out: Candidate[] = [];
  if (input.priorityType) {
    out.push({
      tip: { kind: "priority", priorityType: input.priorityType },
      focus: PRIORITY_FOCUS[input.priorityType as TipPriorityType] ?? "overview",
    });
  }
  if (input.budgetStatus === "over_budget") out.push({ tip: { kind: "budget_over" }, focus: "spending" });
  if (input.budgetStatus === "near_limit") out.push({ tip: { kind: "budget_near_limit" }, focus: "spending" });
  if (input.budgetStatus === null || input.budgetStatus === "no_budget") {
    out.push({ tip: { kind: "no_budget" }, focus: "spending" });
  }
  if (input.pendingSubscriptionCount > 0) {
    out.push({ tip: { kind: "subscriptions_pending", count: input.pendingSubscriptionCount }, focus: "debt" });
  }
  if (input.hasEmergencyFund && input.emergencyFundMonthsProtected > 0) {
    out.push({
      tip: { kind: "emergency_fund_progress", months: Math.round(input.emergencyFundMonthsProtected * 10) / 10 },
      focus: "saving",
    });
  }
  input.insightTypes.forEach((insightType, index) => {
    out.push({ tip: { kind: "insight", insightType, index }, focus: INSIGHT_FOCUS[insightType] });
  });
  return out;
}

/**
 * The companion's tip: the most important candidate in its own focus area;
 * the deep-insights wizard prefers an Insight; the overview spirit simply
 * takes the most important one. Falls back to the overall top candidate,
 * then to a calm "all good" when there's genuinely nothing to raise.
 */
export function pickCompanionTip(focus: CompanionFocus, input: CompanionTipInput): CompanionTip {
  const candidates = buildTipCandidates(input);
  if (candidates.length === 0) return { kind: "all_good" };
  if (focus === "overview") return candidates[0].tip;
  if (focus === "insights") {
    return (candidates.find((c) => c.tip.kind === "insight") ?? candidates[0]).tip;
  }
  return (candidates.find((c) => c.focus === focus) ?? candidates[0]).tip;
}
