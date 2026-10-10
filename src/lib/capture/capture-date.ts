/**
 * The day Quick Capture records into. Defaults to today; the user can pick
 * an earlier day (catching up on yesterday or 30 ก.ย.). Pure helpers.
 */

/** How far back the date wheel scrolls; older days use the calendar. */
export const CAPTURE_WHEEL_DAYS = 90;

function isoOf(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** `days` dates ending at `today`, oldest first — the wheel's rows (today at the bottom). */
export function recentCaptureDates(today: string, days = CAPTURE_WHEEL_DAYS): string[] {
  return Array.from({ length: days }, (_, i) => shift(today, i - (days - 1)));
}

/**
 * The date an item is saved with. Words in the sentence ("เมื่อวาน") win;
 * otherwise — the parser fell back to today — the chosen day applies.
 */
export function applyCaptureDate(parsedDate: string, realToday: string, chosenDate: string): string {
  return parsedDate === realToday ? chosenDate : parsedDate;
}

/** A chosen day is valid only if it's a real date and not in the future. */
export function isValidCaptureDate(date: string, realToday: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  return isoOf(year, month, day) === date && date <= realToday;
}

// ---------------------------------------------------------------------------
// Spoken dates — "วันที่ 8 ตุลาคม กินข้าว 50" records on 8 Oct.
// ---------------------------------------------------------------------------

/** Every way a month is said or typed, January first. Thai spoken forms ("ตุลา") included. */
const MONTH_NAMES: string[][] = [
  ["มกราคม", "มกรา", "ม.ค.", "ม.ค", "มค", "january", "jan"],
  ["กุมภาพันธ์", "กุมภา", "ก.พ.", "ก.พ", "กพ", "february", "feb"],
  ["มีนาคม", "มีนา", "มี.ค.", "มี.ค", "มีค", "march", "mar"],
  ["เมษายน", "เมษา", "เม.ย.", "เม.ย", "เมย", "april", "apr"],
  ["พฤษภาคม", "พฤษภา", "พ.ค.", "พ.ค", "พค", "may"],
  ["มิถุนายน", "มิถุนา", "มิ.ย.", "มิ.ย", "มิย", "june", "jun"],
  ["กรกฎาคม", "กรกฏาคม", "กรกฎา", "กรกฏา", "ก.ค.", "ก.ค", "กค", "july", "jul"],
  ["สิงหาคม", "สิงหา", "ส.ค.", "ส.ค", "สค", "august", "aug"],
  ["กันยายน", "กันยา", "ก.ย.", "ก.ย", "กย", "september", "sept", "sep"],
  ["ตุลาคม", "ตุลา", "ต.ค.", "ต.ค", "ตค", "october", "oct"],
  ["พฤศจิกายน", "พฤศจิกา", "พ.ย.", "พ.ย", "พย", "november", "nov"],
  ["ธันวาคม", "ธันวา", "ธ.ค.", "ธ.ค", "ธค", "december", "dec"],
];

const MONTH_BY_NAME = new Map<string, number>(MONTH_NAMES.flatMap((names, i) => names.map((n) => [n, i + 1] as const)));

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Longest first, so "ตุลาคม" wins over "ตุลา". Latin names must be whole words. */
const MONTH_RE = [...MONTH_BY_NAME.keys()]
  .sort((a, b) => b.length - a.length)
  .map((n) => (/^[a-z]/.test(n) ? `${escapeRe(n)}(?![a-z])` : escapeRe(n)))
  .join("|");

/** Speech often writes the day as a word: "วันที่แปด", "วันที่ยี่สิบเอ็ด". */
const THAI_UNITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_DAY_WORDS = new Map<string, number>(
  Array.from({ length: 31 }, (_, i) => {
    const n = i + 1;
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    const tensWord = ["", "สิบ", "ยี่สิบ", "สามสิบ"][tens];
    const unitWord = unit === 1 && tens > 0 ? "เอ็ด" : THAI_UNITS[unit];
    return [tensWord + unitWord, n] as const;
  })
);
const THAI_DAY_RE = [...THAI_DAY_WORDS.keys()].sort((a, b) => b.length - a.length).join("|");

/**
 * A year only counts when it can't be money: Buddhist 2560–2599 or
 * Christian 2020–2039, and never followed by a currency word.
 */
const YEAR_RE = String.raw`(?:\s*(?:พ\.?\s?ศ\.?|ค\.?\s?ศ\.?)?\s*(25[6-9]\d|20[23]\d)(?!\d)(?!\s*(?:บาท|baht|thb|฿|บ\.)))?`;

const SPOKEN_DATE_PATTERNS: RegExp[] = [
  // "วันที่ 8", "วันที่แปด ตุลา", "วันที่ 8 เดือนตุลาคม 2569" — never a range ("วันที่ 1-15").
  new RegExp(String.raw`วันที่?\s*(\d{1,2}(?!\d)|${THAI_DAY_RE})(?!\s*[-–]\s*\d)(?:\s*(?:เดือน)?\s*(${MONTH_RE})${YEAR_RE})?`, "g"),
  // "8 ต.ค.", "8ตุลา", "8th october" — not the end of a range ("1-15 ก.ย." is a period, not a day).
  new RegExp(String.raw`(?<![\d.,])(?<!\d\s*[-–]\s*)(\d{1,2})(?:st|nd|rd|th)?\s*(?:เดือน)?\s*(${MONTH_RE})${YEAR_RE}`, "g"),
  // "october 8th" — the ordinal is required, so "oct 50" stays an amount.
  new RegExp(String.raw`(?<![a-z])(${MONTH_RE})\s*(\d{1,2})(?:st|nd|rd|th)(?![a-z])`, "g"),
];

/**
 * The day a spoken/typed date means, relative to `today`. Capture records
 * the past, so a day without a month that hasn't come yet is last month's
 * ("วันที่ 25" on 10 Oct → 25 Sep), and a month without a year that hasn't
 * come yet is last year's. Impossible or future dates → null.
 */
export function resolveSpokenDate(day: number, month: number | null, year: number | null, today: string): string | null {
  const [ty, tm] = today.split("-").map(Number);
  if (day < 1 || day > 31) return null;
  let iso: string | null;
  if (month === null) {
    iso = isoOf(ty, tm, day);
    if (!iso || iso > today) iso = tm === 1 ? isoOf(ty - 1, 12, day) : isoOf(ty, tm - 1, day);
  } else {
    const y = year === null ? ty : year >= 2400 ? year - 543 : year;
    iso = isoOf(y, month, day);
    if (year === null && iso && iso > today) iso = isoOf(y - 1, month, day);
  }
  return iso && iso <= today ? iso : null;
}

/**
 * Finds the first date named in (lowercased, normalized) text and the span
 * it occupies — so the parser can drop it from the amount and description.
 */
export interface SpokenDateMention {
  /** Null means the words look like a date, but it is impossible or explicitly in the future. */
  date: string | null;
  start: number;
  end: number;
}

/**
 * Finds the earliest date-shaped phrase even when that date is invalid or in
 * the future. The parser must still remove its digits before looking for an
 * amount ("วันที่ 8 ตุลา 2570 ข้าว 50" must save 50, never 8 or 2570).
 */
export function findSpokenDateMention(lower: string, today: string): SpokenDateMention | null {
  let best: SpokenDateMention | null = null;
  for (const [p, re] of SPOKEN_DATE_PATTERNS.entries()) {
    for (const m of lower.matchAll(re)) {
      if (best && m.index! >= best.start) break;
      const [dayRaw, monthRaw] = p === 2 ? [m[2], m[1]] : [m[1], m[2]];
      const day = /^\d+$/.test(dayRaw) ? Number(dayRaw) : (THAI_DAY_WORDS.get(dayRaw) ?? 0);
      const month = monthRaw ? (MONTH_BY_NAME.get(monthRaw) ?? null) : null;
      const year = p !== 2 && m[3] ? Number(m[3]) : null;
      const date = resolveSpokenDate(day, month, year, today);
      best = { date, start: m.index!, end: m.index! + m[0].length };
      break;
    }
  }
  return best;
}

/** Finds the earliest valid, non-future spoken date. */
export function findSpokenDate(lower: string, today: string): { date: string; start: number; end: number } | null {
  const mention = findSpokenDateMention(lower, today);
  return mention?.date ? { ...mention, date: mention.date } : null;
}
