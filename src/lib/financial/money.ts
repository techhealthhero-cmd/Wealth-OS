/**
 * All money math in this module happens in integer cents (minor units),
 * never floating-point decimals. `0.1 + 0.2 !== 0.3` in IEEE-754 doubles;
 * summing hundreds of transactions with fractional THB amounts would
 * silently accumulate rounding error. Postgres NUMERIC values arrive from
 * Supabase as decimal strings (e.g. "1234.50") — parseMoneyToCents converts
 * them to exact integer cents once, at the boundary, and every calculation
 * downstream stays in that exact integer domain.
 */

/** Parses a NUMERIC(18,2)-shaped value ("1234.50", 1234.5, ...) into integer cents. */
export function parseMoneyToCents(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot parse non-finite number as money: ${value}`);
    }
    return Math.round(value * 100);
  }

  const trimmed = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Cannot parse "${value}" as a money value`);
  }

  const [, sign, whole, fraction = ""] = match;
  const paddedFraction = fraction.padEnd(2, "0");
  const cents = Number(whole) * 100 + Number(paddedFraction);
  return sign === "-" ? -cents : cents;
}

/** Converts integer cents back into a NUMERIC(18,2)-shaped decimal string, e.g. "1234.50". */
export function centsToDecimalString(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Converts integer cents into a plain JS number of major units (for chart libraries, etc). */
export function centsToNumber(cents: number): number {
  return cents / 100;
}

const currencyLocales: Record<string, string> = {
  THB: "th-TH",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
};

/**
 * Formats a money value for display. Accepts cents (the internal
 * representation) so call sites never need to round-trip through decimals.
 *
 * `fractionDigits` defaults to 2 (the normal, precise display everywhere)
 * — pass 0 only for a tightly space-constrained headline number (e.g. a
 * donut chart's center label) where the full decimal string would wrap
 * and visually overlap the ring around it. Never changes the underlying
 * cents value, only what's shown.
 */
export function formatMoney(
  cents: number,
  currencyCode = "THB",
  locale?: string,
  fractionDigits = 2
): string {
  const resolvedLocale = locale ?? currencyLocales[currencyCode] ?? "en-US";
  return new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(centsToNumber(cents));
}

/** Formats a raw NUMERIC(18,2) string/number directly, without a separate parse step. */
export function formatMoneyFromDecimal(
  value: string | number,
  currencyCode = "THB",
  locale?: string
): string {
  return formatMoney(parseMoneyToCents(value), currencyCode, locale);
}
