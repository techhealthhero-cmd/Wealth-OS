/**
 * Emergency Fund — target/progress math. Essential monthly expenses are
 * supplied by the caller (derived from the current month's budget_categories
 * flagged `is_essential`, see src/features/emergency-fund/queries.ts) rather
 * than recomputed here, so this module stays a pure function of its inputs.
 */

export const EMERGENCY_FUND_MONTH_PRESETS = [3, 6, 9, 12] as const;

/** Target amount from either a months-of-expenses multiple or a flat custom amount. Exactly one input should be meaningful; months takes precedence when both are given. */
export function calculateEmergencyFundTarget(
  essentialMonthlyExpensesCents: number,
  targetMonths: number | null,
  customTargetCents: number | null
): number {
  if (targetMonths !== null && targetMonths > 0) {
    return Math.round(essentialMonthlyExpensesCents * targetMonths);
  }
  return customTargetCents ?? 0;
}

/** How many months of essential expenses the current balance would cover. 0 when essential expenses are 0 or unknown (avoids a division-by-zero producing Infinity). */
export function calculateMonthsProtected(
  currentCents: number,
  essentialMonthlyExpensesCents: number
): number {
  if (essentialMonthlyExpensesCents <= 0) return 0;
  return currentCents / essentialMonthlyExpensesCents;
}

export function calculateEmergencyFundProgress(currentCents: number, targetCents: number): number {
  if (targetCents <= 0) return 0;
  return Math.min(100, Math.max(0, (currentCents / targetCents) * 100));
}

/** Estimated completion date at a flat monthly contribution rate. Null when it can never complete at that rate. */
export function calculateEmergencyFundCompletion(
  currentCents: number,
  targetCents: number,
  monthlyContributionCents: number,
  today: Date = new Date()
): Date | null {
  const remaining = targetCents - currentCents;
  if (remaining <= 0) return today;
  if (monthlyContributionCents <= 0) return null;

  const monthsNeeded = Math.ceil(remaining / monthlyContributionCents);
  const projected = new Date(today);
  projected.setMonth(projected.getMonth() + monthsNeeded);
  return projected;
}
