import type { PriorityTool } from "@/features/ai/types";
import { formatMoney } from "@/lib/financial/money";

const CTA_ROUTE: Record<string, string> = {
  negative_cash_flow: "/money/budget",
  no_emergency_fund: "/plan/emergency-fund",
  high_interest_debt: "/plan/debt",
  missed_goal: "/plan/goals",
  low_savings_rate: "/money/budget",
  weak_income_growth: "/money/transactions",
  no_investment_contribution: "/money/transactions",
  income_gap: "/earn",
};

export interface NextBestActionText {
  actionText: string;
  cta?: string;
}

/**
 * Pure transformation from a deterministic `PriorityTool` (Day 3's Financial
 * Priority Engine, unchanged) into display text. Deliberately an explicit
 * switch per `priorityType` rather than a generic "if amountCents is set"
 * fallback — the same field means different things for different
 * priorities. In particular, `amountCents` on `high_interest_debt` is the
 * liability's outstanding BALANCE, not a suggested payment, and must never
 * be shown as if it were one; that priority instead uses `targetValue`
 * (the interest rate).
 *
 * `t` is the caller's translation function so this stays locale-agnostic —
 * it only decides *which* fields go into the sentence, never the words.
 */
export function buildNextBestActionText(priority: PriorityTool, t: (key: string) => string): NextBestActionText {
  const actionPrefix = t(`nextBestAction.actions.${priority.priorityType}`);
  const cta = CTA_ROUTE[priority.priorityType];
  let actionText = actionPrefix;

  switch (priority.priorityType) {
    case "negative_cash_flow":
      actionText =
        priority.amountCents !== undefined
          ? `${actionPrefix} ${formatMoney(priority.amountCents)} ${t("nextBestAction.perMonth")}`
          : actionPrefix;
      break;
    case "no_emergency_fund":
      actionText = priority.amountCents !== undefined ? `${actionPrefix} ${formatMoney(priority.amountCents)}` : actionPrefix;
      break;
    case "missed_goal":
      actionText =
        priority.goalName && priority.amountCents !== undefined
          ? `${actionPrefix} "${priority.goalName}": ${formatMoney(priority.amountCents)}/${t("nextBestAction.perMonth")}`
          : actionPrefix;
      break;
    case "low_savings_rate":
      actionText = priority.targetPercent !== undefined ? `${actionPrefix} ${priority.targetPercent}%` : actionPrefix;
      break;
    case "high_interest_debt":
      actionText = priority.goalName
        ? `${actionPrefix} ${priority.goalName}${priority.targetValue !== undefined ? ` (${t("nextBestAction.atInterestRate")} ${priority.targetValue}%)` : ""}`
        : actionPrefix;
      break;
    case "income_gap":
      actionText =
        priority.amountCents !== undefined
          ? `${actionPrefix} ${formatMoney(priority.amountCents)} ${t("nextBestAction.perMonth")}`
          : actionPrefix;
      break;
    default:
      actionText = actionPrefix;
  }

  return { actionText, cta };
}
