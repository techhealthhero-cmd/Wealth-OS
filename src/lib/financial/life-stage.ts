/**
 * Financial Life Stage — 7-stage deterministic classification. Each stage
 * requires meeting its own criteria PLUS every earlier stage's criteria
 * (cumulative gates), so a user can never skip ahead on a fluke and always
 * regresses cleanly if their situation gets worse. No AI judgment anywhere.
 */

export type LifeStage =
  | "survival"
  | "stable"
  | "protected"
  | "debt_controlled"
  | "investor"
  | "wealth_builder"
  | "financial_freedom";

export const LIFE_STAGE_ORDER: LifeStage[] = [
  "survival",
  "stable",
  "protected",
  "debt_controlled",
  "investor",
  "wealth_builder",
  "financial_freedom",
];

// Thresholds, named so the exact rule is grep-able and easy to tune later.
export const HIGH_INTEREST_RATE_THRESHOLD_PERCENT = 15;
export const PROTECTED_MIN_MONTHS = 3;
export const INVESTOR_MIN_SAVINGS_RATE_PERCENT = 10;
export const WEALTH_BUILDER_MIN_SAVINGS_RATE_PERCENT = 20;
/** The "4% rule": net worth that could sustain current spending indefinitely at a 4%/year draw. */
export const FINANCIAL_FREEDOM_EXPENSE_MULTIPLE = 25;

export interface LifeStageInputs {
  cashFlowCents: number;
  emergencyFundMonthsProtected: number;
  hasHighInterestDebt: boolean;
  savingsRatePercent: number;
  hasInvestmentActivity: boolean;
  netWorthCents: number;
  annualExpensesCents: number;
}

export interface LifeStageCriterion {
  met: boolean;
  /** English, fixed wording — for logs/tests only. The UI must render `lifeStage.criteria.<stage>` from the i18n dictionary instead, never this field, so the explanation is locale-aware. */
  description: string;
}

export interface LifeStageResult {
  stage: LifeStage;
  /** Every criterion checked, in stage order, so the UI can show exactly why the user landed where they did. */
  criteria: Record<LifeStage, LifeStageCriterion>;
  nextStage: LifeStage | null;
  /** Criteria still unmet for nextStage — the "measurable next actions". */
  nextStageRequirements: LifeStageCriterion[];
}

function evaluateCriteria(inputs: LifeStageInputs): Record<LifeStage, LifeStageCriterion> {
  return {
    survival: { met: true, description: "Baseline — every user starts here." },
    stable: {
      met: inputs.cashFlowCents >= 0,
      description: "Monthly cash flow is not negative (income covers expenses).",
    },
    protected: {
      met: inputs.emergencyFundMonthsProtected >= PROTECTED_MIN_MONTHS,
      description: `Emergency fund covers at least ${PROTECTED_MIN_MONTHS} months of essential expenses.`,
    },
    debt_controlled: {
      met: !inputs.hasHighInterestDebt,
      description: `No liability with an interest rate at or above ${HIGH_INTEREST_RATE_THRESHOLD_PERCENT}%/year.`,
    },
    investor: {
      met: inputs.savingsRatePercent >= INVESTOR_MIN_SAVINGS_RATE_PERCENT && inputs.hasInvestmentActivity,
      description: `Savings rate at least ${INVESTOR_MIN_SAVINGS_RATE_PERCENT}% and actively contributing to investments.`,
    },
    wealth_builder: {
      met: inputs.savingsRatePercent >= WEALTH_BUILDER_MIN_SAVINGS_RATE_PERCENT && inputs.netWorthCents > 0,
      description: `Savings rate at least ${WEALTH_BUILDER_MIN_SAVINGS_RATE_PERCENT}% and positive net worth.`,
    },
    financial_freedom: {
      met:
        inputs.annualExpensesCents > 0 &&
        inputs.netWorthCents >= inputs.annualExpensesCents * FINANCIAL_FREEDOM_EXPENSE_MULTIPLE,
      description: `Net worth is at least ${FINANCIAL_FREEDOM_EXPENSE_MULTIPLE}x annual expenses (can sustain spending indefinitely at a 4% draw).`,
    },
  };
}

export function calculateFinancialLifeStage(inputs: LifeStageInputs): LifeStageResult {
  const criteria = evaluateCriteria(inputs);

  let stage: LifeStage = "survival";
  for (const candidate of LIFE_STAGE_ORDER) {
    if (criteria[candidate].met) {
      stage = candidate;
    } else {
      break; // cumulative gate — stop at the first unmet stage
    }
  }

  const currentIndex = LIFE_STAGE_ORDER.indexOf(stage);
  const nextStage = currentIndex < LIFE_STAGE_ORDER.length - 1 ? LIFE_STAGE_ORDER[currentIndex + 1] : null;
  const nextStageRequirements = nextStage ? [criteria[nextStage]].filter((c) => !c.met) : [];

  return { stage, criteria, nextStage, nextStageRequirements };
}
