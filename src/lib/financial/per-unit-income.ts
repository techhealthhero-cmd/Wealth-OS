/**
 * Per-unit income — money earned per piece of work (฿200 per drink, per
 * delivery, per class). Deterministic: monthly = rate × units, in cents,
 * rounded once at the end so fractional units (e.g. 12.5 hours) are exact.
 */
export function calculatePerUnitMonthlyCents(unitRateCents: number, unitsPerMonth: number): number {
  if (!Number.isFinite(unitRateCents) || !Number.isFinite(unitsPerMonth)) return 0;
  if (unitRateCents <= 0 || unitsPerMonth <= 0) return 0;
  return Math.round(unitRateCents * unitsPerMonth);
}
