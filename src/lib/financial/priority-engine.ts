/**
 * Financial Priority Engine — identifies the user's single most urgent
 * financial issue, deterministically. This is Day 3 groundwork for Day 4's
 * AI Money Coach (CLAUDE.md "NEXT BEST ACTION ENGINE") — it returns
 * structured data only, no conversational text and no LLM involvement.
 *
 * Priority ordering follows CLAUDE.md's existing "Next Best Action" list
 * (negative cash flow > emergency fund > high-interest debt > goals >
 * income gap > investing > expense optimization), extended with the
 * additional issue types this task names (missed goal, weak income growth).
 */

export type PriorityType =
  | "negative_cash_flow"
  | "no_emergency_fund"
  | "high_interest_debt"
  | "low_savings_rate"
  | "missed_goal"
  | "no_investment_contribution"
  | "weak_income_growth";

export type PrioritySeverity = "critical" | "high" | "medium" | "low";

export interface FinancialPriority {
  priorityType: PriorityType;
  severity: PrioritySeverity;
  /** Machine-readable context for the recommended action — the UI/i18n layer composes the sentence, same pattern as WealthScoreAction. */
  amountCents?: number;
  targetPercent?: number;
  goalName?: string;
  targetValue: number;
}

export interface PriorityEngineInputs {
  cashFlowCents: number;
  emergencyFundMonthsProtected: number;
  emergencyFundTargetMonths: number;
  essentialMonthlyExpensesCents: number;
  emergencyFundCurrentCents: number;
  highInterestLiabilities: { name: string; balanceCents: number; interestRatePercent: number }[];
  savingsRatePercent: number;
  hasInvestmentActivity: boolean;
  behindGoals: { name: string; requiredMonthlyContributionCents: number | null }[];
  incomeGrowthPercent: number | null; // null when there's no prior month to compare (handled as "no data", not penalized)
}

const RANK: Record<PriorityType, number> = {
  negative_cash_flow: 0,
  no_emergency_fund: 1,
  high_interest_debt: 2,
  missed_goal: 3,
  low_savings_rate: 4,
  weak_income_growth: 5,
  no_investment_contribution: 6,
};

/** Returns every real issue found, ranked most-urgent first. Empty when nothing is actionable. */
export function getFinancialPriorities(inputs: PriorityEngineInputs): FinancialPriority[] {
  const priorities: FinancialPriority[] = [];

  if (inputs.cashFlowCents < 0) {
    priorities.push({
      priorityType: "negative_cash_flow",
      severity: "critical",
      amountCents: Math.abs(inputs.cashFlowCents),
      targetValue: 0,
    });
  }

  if (inputs.emergencyFundMonthsProtected < inputs.emergencyFundTargetMonths) {
    const targetCents = inputs.essentialMonthlyExpensesCents * inputs.emergencyFundTargetMonths;
    const gapCents = Math.max(0, targetCents - inputs.emergencyFundCurrentCents);
    if (gapCents > 0) {
      priorities.push({
        priorityType: "no_emergency_fund",
        severity: inputs.emergencyFundMonthsProtected < 1 ? "critical" : "high",
        amountCents: gapCents,
        targetValue: inputs.emergencyFundTargetMonths,
      });
    }
  }

  if (inputs.highInterestLiabilities.length > 0) {
    const worst = [...inputs.highInterestLiabilities].sort(
      (a, b) => b.interestRatePercent - a.interestRatePercent
    )[0];
    priorities.push({
      priorityType: "high_interest_debt",
      severity: "high",
      amountCents: worst.balanceCents,
      goalName: worst.name,
      targetValue: worst.interestRatePercent,
    });
  }

  if (inputs.behindGoals.length > 0) {
    const goal = inputs.behindGoals[0];
    priorities.push({
      priorityType: "missed_goal",
      severity: "medium",
      amountCents: goal.requiredMonthlyContributionCents ?? undefined,
      goalName: goal.name,
      targetValue: 0,
    });
  }

  if (inputs.savingsRatePercent < 10) {
    priorities.push({
      priorityType: "low_savings_rate",
      severity: "medium",
      targetPercent: 10,
      targetValue: 10,
    });
  }

  if (inputs.incomeGrowthPercent !== null && inputs.incomeGrowthPercent < 0) {
    priorities.push({
      priorityType: "weak_income_growth",
      severity: "low",
      targetValue: 0,
    });
  }

  if (!inputs.hasInvestmentActivity && inputs.cashFlowCents > 0 && inputs.savingsRatePercent >= 10) {
    // Only worth flagging once the basics (positive cash flow, a real
    // savings habit) are already in place — otherwise "start investing" is
    // premature advice ahead of "stop the bleeding" issues above it.
    priorities.push({
      priorityType: "no_investment_contribution",
      severity: "low",
      targetValue: 0,
    });
  }

  return priorities.sort((a, b) => RANK[a.priorityType] - RANK[b.priorityType]);
}

/** The single most urgent issue, or null when there's nothing actionable. */
export function getTopFinancialPriority(inputs: PriorityEngineInputs): FinancialPriority | null {
  return getFinancialPriorities(inputs)[0] ?? null;
}
