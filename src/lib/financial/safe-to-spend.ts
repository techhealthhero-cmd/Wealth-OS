/**
 * Safe-to-Spend — deterministic discretionary-cash estimate. Every input is
 * a real number the caller must supply; this module never invents a value.
 * When required data is missing, the caller should show an "incomplete
 * data" state instead of calling this with fabricated inputs.
 *
 *   Available liquid cash
 *   − upcoming required bills
 *   − minimum required debt payments
 *   − planned savings allocation
 *   − planned investment allocation
 *   − protected emergency-fund amount
 *   − mandatory commitments
 *   = discretionary available amount
 */
export interface SafeToSpendInputs {
  availableLiquidCents: number;
  upcomingBillsCents: number;
  minimumDebtPaymentsCents: number;
  plannedSavingsCents: number;
  plannedInvestmentCents: number;
  protectedEmergencyFundCents: number;
  mandatoryCommitmentsCents: number;
}

export interface SafeToSpendResult {
  discretionaryCents: number;
  todayCents: number;
  thisWeekCents: number;
  thisMonthCents: number;
  breakdown: SafeToSpendInputs;
}

/**
 * @param daysRemainingInMonth Including today; must be >= 1.
 * @param weeksRemainingInMonth Including the current partial week; must be >= 1.
 */
export function calculateSafeToSpend(
  inputs: SafeToSpendInputs,
  daysRemainingInMonth: number,
  weeksRemainingInMonth: number
): SafeToSpendResult {
  const discretionaryCents = Math.max(
    0,
    inputs.availableLiquidCents -
      inputs.upcomingBillsCents -
      inputs.minimumDebtPaymentsCents -
      inputs.plannedSavingsCents -
      inputs.plannedInvestmentCents -
      inputs.protectedEmergencyFundCents -
      inputs.mandatoryCommitmentsCents
  );

  const safeDays = Math.max(1, daysRemainingInMonth);
  const safeWeeks = Math.max(1, weeksRemainingInMonth);

  return {
    discretionaryCents,
    todayCents: Math.floor(discretionaryCents / safeDays),
    thisWeekCents: Math.floor(discretionaryCents / safeWeeks),
    thisMonthCents: discretionaryCents,
    breakdown: inputs,
  };
}
