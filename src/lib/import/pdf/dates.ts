/**
 * Date parsing for Thai bank statements: dd/mm/yy, dd/mm/yyyy (also "-" and
 * "." separators), Thai/English month names, Thai digits, and Buddhist-era
 * years (2569 → 2026). Pure and deterministic — the reference year is passed
 * in so tests never depend on the clock.
 */

const BUDDHIST_ERA_OFFSET = 543;

export function buddhistToGregorian(year: number): number {
  return year - BUDDHIST_ERA_OFFSET;
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

export function thaiDigitsToArabic(text: string): string {
  return text.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)));
}

/** Keys are month names lower-cased with dots/spaces removed. */
const MONTHS: Record<string, number> = {
  มค: 1, มกราคม: 1, jan: 1, january: 1,
  กพ: 2, กุมภาพันธ์: 2, feb: 2, february: 2,
  มีค: 3, มีนาคม: 3, mar: 3, march: 3,
  เมย: 4, เมษายน: 4, apr: 4, april: 4,
  พค: 5, พฤษภาคม: 5, may: 5,
  มิย: 6, มิถุนายน: 6, jun: 6, june: 6,
  กค: 7, กรกฎาคม: 7, jul: 7, july: 7,
  สค: 8, สิงหาคม: 8, aug: 8, august: 8,
  กย: 9, กันยายน: 9, sep: 9, sept: 9, september: 9,
  ตค: 10, ตุลาคม: 10, oct: 10, october: 10,
  พย: 11, พฤศจิกายน: 11, nov: 11, november: 11,
  ธค: 12, ธันวาคม: 12, dec: 12, december: 12,
};

export function monthFromName(name: string): number | null {
  return MONTHS[name.toLowerCase().replace(/[.\s]/g, "")] ?? null;
}

/**
 * Four-digit years ≥ 2400 are Buddhist era. Two-digit years are ambiguous
 * ("69" is BE 2569 = 2026; "26" is CE 2026), so pick whichever reading lands
 * closest to the reference year.
 */
export function resolveStatementYear(raw: string, refYear: number): number {
  const value = Number(raw);
  if (raw.length >= 3) return value >= 2400 ? buddhistToGregorian(value) : value;
  const gregorian = 2000 + value;
  const buddhist = buddhistToGregorian(2500 + value);
  return Math.abs(buddhist - refYear) < Math.abs(gregorian - refYear) ? buddhist : gregorian;
}

function toIso(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const NUMERIC_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?![\d/.-])/;
const NAMED_DATE = /^(\d{1,2})[\s-]*([A-Za-z฀-๿.]+?)[\s-]*(\d{4}|\d{2})(?!\d)/;

export interface LeadingDate {
  iso: string;
  /** Number of characters consumed from the start of the input. */
  length: number;
}

/** Parses a date at the very start of `text` (after leading whitespace). */
export function parseLeadingDate(text: string, refYear: number): LeadingDate | null {
  const input = thaiDigitsToArabic(text);
  const offset = input.length - input.trimStart().length;
  const value = input.slice(offset);

  const numeric = NUMERIC_DATE.exec(value);
  if (numeric) {
    const iso = toIso(resolveStatementYear(numeric[3], refYear), Number(numeric[2]), Number(numeric[1]));
    return iso ? { iso, length: offset + numeric[0].length } : null;
  }
  const named = NAMED_DATE.exec(value);
  if (named) {
    const month = monthFromName(named[2]);
    if (!month) return null;
    const iso = toIso(resolveStatementYear(named[3], refYear), month, Number(named[1]));
    return iso ? { iso, length: offset + named[0].length } : null;
  }
  return null;
}

/** Convenience for a standalone date token. */
export function parseStatementDate(text: string, refYear: number): string | null {
  const parsed = parseLeadingDate(text, refYear);
  return parsed && !text.slice(parsed.length).trim() ? parsed.iso : null;
}
