/**
 * Money tokens on statements always carry two decimals ("1,234.56"). This
 * requirement is what separates amounts from account numbers, references and
 * times. Values are returned as integer satang — no floating-point money.
 */

export interface AmountToken {
  /** Absolute value in satang/cents. */
  cents: number;
  /** True for a leading "-", a trailing "-", parentheses, or a DR marker. */
  negative: boolean;
  /** Explicit CR/DR marker if the statement printed one. */
  marker: "cr" | "dr" | null;
  index: number;
  length: number;
}

const AMOUNT_RE = /(?<![\w.,/:-])(\(?)([-+]?)(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})(\)?)(-?)(?:\s?(CR|DR|Cr|Dr|cr|dr)\b)?(?![\w.,/:])/g;

export function findAmountTokens(text: string): AmountToken[] {
  const tokens: AmountToken[] = [];
  for (const match of text.matchAll(AMOUNT_RE)) {
    const [whole, open, sign, integer, fraction, close, trailingMinus, marker] = match;
    if (Boolean(open) !== Boolean(close)) continue;
    const cents = Number(integer.replace(/,/g, "")) * 100 + Number(fraction);
    if (!Number.isSafeInteger(cents)) continue;
    const normalizedMarker = marker ? (marker.toLowerCase() as "cr" | "dr") : sign === "+" ? "cr" : null;
    tokens.push({
      cents,
      negative: sign === "-" || Boolean(open) || trailingMinus === "-" || normalizedMarker === "dr",
      marker: normalizedMarker,
      index: match.index,
      length: whole.length,
    });
  }
  return tokens;
}

/** Parses a cell that must be exactly one amount. */
export function parseAmountCell(text: string): AmountToken | null {
  const trimmed = text.trim();
  const tokens = findAmountTokens(trimmed);
  return tokens.length === 1 && tokens[0].index === 0 && tokens[0].length === trimmed.length ? tokens[0] : null;
}

export function signedCents(token: AmountToken): number {
  return token.negative ? -token.cents : token.cents;
}

/** Formats integer cents as a plain decimal string ("-1234.50"), no grouping. */
export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
