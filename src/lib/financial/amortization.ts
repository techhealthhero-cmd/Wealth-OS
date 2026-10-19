/** All money inputs/outputs are integer cents; rates are annual percentages. */
export function splitInstallment({ balanceCents, annualRatePct, paymentCents }: {
  balanceCents: number; annualRatePct: number; paymentCents: number;
}) {
  if (!Number.isSafeInteger(balanceCents) || balanceCents < 0 || !Number.isSafeInteger(paymentCents) || paymentCents < 0 || !Number.isFinite(annualRatePct) || annualRatePct < 0) throw new RangeError("Invalid installment");
  const rawInterest = balanceCents * annualRatePct / 1200;
  const interestCents = Math.floor(rawInterest + .5 + Number.EPSILON * Math.abs(rawInterest));
  if (!Number.isSafeInteger(interestCents)) throw new RangeError("Interest exceeds safe cents range");
  const principalCents = Math.min(balanceCents, Math.max(0, paymentCents - interestCents));
  return { principalCents, interestCents, balanceCents: balanceCents - principalCents };
}
