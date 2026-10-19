/** Pure tax-jar calculations; all amounts are integer satang. */
export const TAX_JAR_SUGGESTED_RATES = [5, 7, 10] as const;
export const TAX_JAR_DEFAULT_RATE_PCT = 7;
export type TaxJarMode = "ask" | "auto";

function assertCents(value: number): void {
  if (!Number.isSafeInteger(value)) throw new Error("Expected safe integer satang");
}

/** Round an income allocation half-up; rates may range from 0 through 50%. */
export function calculateSetAside(incomeCents: number, ratePct = TAX_JAR_DEFAULT_RATE_PCT): number {
  assertCents(incomeCents);
  if (incomeCents < 0) throw new Error("Income must be non-negative");
  if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 50) {
    throw new Error("Rate must be between 0 and 50");
  }
  return Math.round(incomeCents * ratePct / 100);
}

/** Coverage is capped at 100%; no positive tax due means the jar is on track. */
export function jarProgress(balanceCents: number, estimatedTaxDueCents: number) {
  assertCents(balanceCents);
  assertCents(estimatedTaxDueCents);
  const due = Math.max(0, estimatedTaxDueCents);
  return {
    pct: due === 0 ? 100 : Math.max(0, Math.min(100, balanceCents / due * 100)),
    shortfallCents: Math.max(0, due - balanceCents),
    surplusCents: Math.max(0, balanceCents - due),
    onTrack: balanceCents >= due || due === 0,
  };
}
