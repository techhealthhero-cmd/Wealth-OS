/** ESTIMATE ONLY. Pure implementation of the proposed rules, not a tax filing calculation. */
/** Personal allowance in satang — pending user approval. */
export const PERSONAL_ALLOWANCE = 60000_00;
/** Section 40(2) expense deduction — pending user approval. */
export const EXPENSE_40_2 = { ratePct: 50, capCents: 100000_00 } as const;
/** Configurable Section 40(8) default expense percentage — pending user approval. */
export const EXPENSE_40_8_DEFAULT_RATE_PCT = 60;
/** Marginal brackets in satang — pending user approval. */
export const TAX_BRACKETS = [
  { upperBoundCents: 150000_00, ratePct: 0 },
  { upperBoundCents: 300000_00, ratePct: 5 },
  { upperBoundCents: 500000_00, ratePct: 10 },
  { upperBoundCents: 750000_00, ratePct: 15 },
  { upperBoundCents: 1000000_00, ratePct: 20 },
  { upperBoundCents: 2000000_00, ratePct: 25 },
  { upperBoundCents: 5000000_00, ratePct: 30 },
  { upperBoundCents: Infinity, ratePct: 35 },
] as const;
/** Minimum-tax gross income threshold in satang — pending user approval. */
export const MINIMUM_TAX_INCOME_THRESHOLD_CENTS = 120000_00;
/** Minimum-tax percentage — pending user approval. */
export const MINIMUM_TAX_RATE_PCT = 0.5;
/** Minimum tax at or below this amount is ignored — pending user approval. */
export const MINIMUM_TAX_EXEMPTION_CENTS = 5000_00;

function assertAmount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Expected non-negative safe integer satang");
}

/** Project year-to-date money to twelve months, rounding half-up to satang. */
export function annualize(ytdCents: number, monthsElapsed: number): number {
  assertAmount(ytdCents);
  if (!Number.isInteger(monthsElapsed) || monthsElapsed < 1 || monthsElapsed > 12) {
    throw new Error("Months elapsed must be an integer from 1 to 12");
  }
  const annual = Math.round(ytdCents * 12 / monthsElapsed);
  assertAmount(annual);
  return annual;
}

function bracketBreakdown(netIncomeCents: number) {
  assertAmount(netIncomeCents);
  let lowerBoundCents = 0;
  return TAX_BRACKETS.map(({ upperBoundCents, ratePct }) => {
    const taxableCents = Math.max(0, Math.min(netIncomeCents, upperBoundCents) - lowerBoundCents);
    const row = { lowerBoundCents, upperBoundCents, ratePct, taxableCents, taxCents: Math.round(taxableCents * ratePct / 100) };
    lowerBoundCents = upperBoundCents;
    return row;
  });
}

/** Apply marginal rates to each occupied band, rounding each band's tax to satang. */
export function progressiveTax(netIncomeCents: number): number {
  return bracketBreakdown(netIncomeCents).reduce((sum, band) => sum + band.taxCents, 0);
}

/** Estimate annual tax and subtract annualized withholding; negative due means a refund. */
export function estimateYearEndTax({
  income402YtdCents, income408YtdCents, monthsElapsed, withholdingYtdCents,
  extraDeductionsCents = 0, expense408RatePct = EXPENSE_40_8_DEFAULT_RATE_PCT,
}: {
  income402YtdCents: number; income408YtdCents: number; monthsElapsed: number;
  withholdingYtdCents: number; extraDeductionsCents?: number; expense408RatePct?: number;
}) {
  assertAmount(extraDeductionsCents);
  if (!Number.isFinite(expense408RatePct) || expense408RatePct < 0 || expense408RatePct > 100) {
    throw new Error("Expense rate must be between 0 and 100");
  }
  const annual402 = annualize(income402YtdCents, monthsElapsed);
  const annual408 = annualize(income408YtdCents, monthsElapsed);
  const gross = annual402 + annual408;
  assertAmount(gross);
  const expense402 = Math.min(Math.round(annual402 * EXPENSE_40_2.ratePct / 100), EXPENSE_40_2.capCents);
  const expense408 = Math.round(annual408 * expense408RatePct / 100);
  const netIncome = Math.max(0, gross - expense402 - expense408 - PERSONAL_ALLOWANCE - extraDeductionsCents);
  const breakdown = bracketBreakdown(netIncome);
  const progressiveTaxCents = breakdown.reduce((sum, band) => sum + band.taxCents, 0);
  const minimumTaxCents = gross >= MINIMUM_TAX_INCOME_THRESHOLD_CENTS
    ? Math.round(gross * MINIMUM_TAX_RATE_PCT / 100) : 0;
  const applicableMinimum = minimumTaxCents > MINIMUM_TAX_EXEMPTION_CENTS ? minimumTaxCents : 0;
  const taxCents = Math.max(progressiveTaxCents, applicableMinimum);
  const annualWithholdingCents = annualize(withholdingYtdCents, monthsElapsed);
  return {
    annual402, annual408, expense402, expense408, netIncome, progressiveTaxCents,
    minimumTaxCents, taxCents, annualWithholdingCents,
    estimatedDueCents: taxCents - annualWithholdingCents, breakdown,
  };
}
