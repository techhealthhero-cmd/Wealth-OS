/** Income Gap — deterministic comparison of a user's target vs. their real average income. */

export interface IncomeGapInputs {
  targetMonthlyIncomeCents: number | null;
  averageMonthlyIncomeCents: number;
}

export interface IncomeGapResult {
  hasTarget: boolean;
  targetMonthlyIncomeCents: number | null;
  /** Positive = shortfall still to close. 0 or negative (clamped to 0) means the target is met. Null when there's no target set. */
  gapCents: number | null;
  achieved: boolean;
}

export function calculateIncomeGap(inputs: IncomeGapInputs): IncomeGapResult {
  if (inputs.targetMonthlyIncomeCents === null) {
    return { hasTarget: false, targetMonthlyIncomeCents: null, gapCents: null, achieved: false };
  }

  const rawGap = inputs.targetMonthlyIncomeCents - inputs.averageMonthlyIncomeCents;
  const achieved = rawGap <= 0;

  return {
    hasTarget: true,
    targetMonthlyIncomeCents: inputs.targetMonthlyIncomeCents,
    gapCents: achieved ? 0 : rawGap,
    achieved,
  };
}
