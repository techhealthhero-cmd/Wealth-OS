/**
 * Daily money recap — one long spoken/typed sentence → many transactions.
 *
 *   "กินข้าว 40 บาท น้ำ 10 บาท ขนม 50 วินมอไซต์ 40 ไปกลับ 80
 *    วันนี้เงินเดือนออก 20,000 แม่ให้ 2,000"
 *     → ข้าว ฿40 · น้ำ ฿10 · ขนม ฿50 · วินมอไซต์ ไปกลับ ฿80
 *       · เงินเดือน +฿20,000 · แม่ให้ +฿2,000
 *
 * Pure and deterministic (no I/O, no LLM). Speech recognition rarely adds
 * punctuation, so items are split at their AMOUNTS: each amount closes the
 * item it belongs to. Every item then goes through the exact same
 * single-item parser (`parseCaptureText`), so categories, accounts, learned
 * preferences and income detection behave identically to Quick Capture.
 *
 * Numbers that are not amounts never split an item: digits inside known
 * brands ("7-11"), dates ("วันที่ 15"), clock times ("8 โมง", "10:30") and
 * quantities followed by a unit word ("ข้าว 2 จาน 120").
 */
import { KNOWN_MERCHANTS } from "./keywords";
import {
  AMOUNT_PATTERN,
  findKeyword,
  normalizeText,
  parseCaptureText,
  type Match,
  type ParseContext,
  type ParsedCapture,
} from "./transaction-parser";

/** A unit word right after a number makes it a quantity, not a price. */
const QUANTITY_UNITS = [
  "จาน", "แก้ว", "ขวด", "ชิ้น", "อัน", "ห่อ", "กล่อง", "ถุง", "ชาม", "ลูก", "ตัว", "ใบ", "เม็ด", "แพ็ค", "แพ็ก",
  "คน", "ที่", "ถ้วย", "กระป๋อง", "ซอง", "หลอด", "กิโล", "กก", "kg", "pcs", "x", "ไม้", "ชุด",
];

/**
 * An item that is only one of these words refines the PREVIOUS item instead
 * of being a new one: "วินมอไซต์ 40 ไปกลับ 80" is one 80-baht ride.
 */
const MERGE_MODIFIERS = ["ไปกลับ", "ไป-กลับ", "รวม", "รวมเป็น", "ทั้งหมด", "รวมทั้งหมด", "รวมๆ", "total", "round trip"];

/** Joining words at the start of an item ("กับน้ำ 10", "แล้วก็ขนม 50"). */
const LEADING_CONNECTORS = ["แล้วก็", "และก็", "และ", "แล้ว", "กับ", "ต่อด้วย", "อีก", "ก็", "then", "and", "plus"];

/** Payment words that, right after an amount, belong to the item before. */
const PAYMENT_LEADS = ["จ่ายเงินสด", "จ่ายด้วย", "จ่ายผ่าน", "จ่ายบัตร", "เงินสด", "โอนจ่าย", "บัตรเครดิต", "ผ่าน", "ด้วย", "cash", "card", "paid"];
const CONNECTOR_INSIDE = /\s(?:แล้วก็|และก็|และ|แล้ว|กับ|ต่อด้วย|อีก|then|and|plus)\s?/;

/** Recap preambles that are not part of any item. */
const PREAMBLES = [
  "วันนี้ใช้อะไรไปบ้าง", "ใช้อะไรไปบ้าง", "วันนี้ใช้เงินไป", "วันนี้ใช้ไป", "ใช้เงินไป", "สรุปวันนี้", "สรุปรายการ",
  "สรุป", "ใช้ไป", "today i spent", "i spent",
];

/** Dates/times that look like amounts — masked before splitting. */
const NON_AMOUNT_NUMBERS: RegExp[] = [
  /วันที่\s*\d{1,2}/g,
  // Thai dates: "15 ก.ย.", "1-15 ก.ย.", "18 กันยา".
  /\d{1,2}(?:\s*-\s*\d{1,2})?\s*(?:ม\.?ค|ก\.?พ|มี\.?ค|เม\.?ย|พ\.?ค|มิ\.?ย|ก\.?ค|ส\.?ค|ก\.?ย|ต\.?ค|พ\.?ย|ธ\.?ค|มกรา|กุมภา|มีนา|เมษา|พฤษภา|มิถุนา|กรกฎา|สิงหา|กันยา|ตุลา|พฤศจิกา|ธันวา)\S*/g,
  // Clock times ("10:30", "8.15 น."). Only a standalone 1–2 digit hour —
  // reported 2026-10-05: "1760.50 บาท" was read as 17 + the time "60.50" —
  // and never a number followed by a currency word ("10.50 บาท" is money).
  /(?<![\d.,])\d{1,2}\s*[:.]\s*\d{2}(?!\d)(?!\s*(?:บาท|baht|thb|฿|บ\.))\s*(?:น\.|นาฬิกา)?/g,
  /\d{1,2}\s*(?:โมง|ทุ่ม|นาฬิกา)/g,
  /(?:ตี|บ่าย)\s*\d{1,2}/g,
  // IDs, phone and account numbers: 9+ digits in a row is never a daily amount.
  /\d{9,}/g,
  // Codes glued to letters or joiners: "99/1", "1-2", "A1", "jcn832", "3BB".
  // (Order matters: "99/1" must be masked whole before the lookbehind runs.)
  /\d+(?=[/-]\d)/g,
  /(?<=[A-Za-z#/-])\d+/g,
  /\d+(?=[A-Za-z]{2})/g,
];

export interface RecapItem extends ParsedCapture {
  /** Stable within one parse: index-based. */
  key: string;
  /** The words this item came from — shown so the user can check it. */
  sourceText: string;
}

function mask(text: string, span: Match): string {
  return text.slice(0, span.start) + "#".repeat(span.end - span.start) + text.slice(span.end);
}

/** Replaces brand names, dates and times with '#' (same length), so their digits can't split items. */
function maskNonAmounts(text: string): string {
  let masked = text;
  let lower = masked.toLowerCase();
  for (const merchant of KNOWN_MERCHANTS) {
    for (const kw of merchant.match) {
      if (!/\d/.test(kw)) continue;
      for (let guard = 0; guard < 20; guard++) {
        const span = findKeyword(lower, kw);
        if (!span) break;
        masked = mask(masked, span);
        lower = masked.toLowerCase();
      }
    }
  }
  for (const re of NON_AMOUNT_NUMBERS) {
    masked = masked.replace(re, (m) => "#".repeat(m.length));
  }
  return masked;
}

/**
 * The unit must be a whole word: "ข้าว 2 จาน 120" is a quantity, but in
 * "Grab 230 ลูกชิ้น 40" the "ลูก" is the start of the NEXT item's name
 * (ลูกชิ้น), so 230 is a price. Reported 2026-10-03: the old prefix check
 * merged that into one ฿40 item.
 */
function isQuantity(masked: string, end: number): boolean {
  const after = masked.slice(end).trimStart().toLowerCase();
  return QUANTITY_UNITS.some((u) => after.startsWith(u) && !/^[\p{L}\p{M}]/u.test(after.slice(u.length)));
}

function stripLeading(text: string, words: string[]): string {
  let out = text.trim();
  for (let changed = true; changed; ) {
    changed = false;
    for (const w of [...words].sort((a, b) => b.length - a.length)) {
      if (out.toLowerCase().startsWith(w) && out.length > w.length) {
        out = out.slice(w.length).trim();
        changed = true;
      }
    }
  }
  return out;
}

/** The words of an item with its amount removed — used to spot "ไปกลับ 80"-style modifiers. */
function labelOf(segment: string): string {
  return segment
    .replace(AMOUNT_PATTERN, " ")
    .replace(/[฿,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Splits a recap into item texts. Each amount ends an item; text after the
 * last amount (e.g. "จ่ายเงินสด") belongs to the item before it. A segment
 * that is only a modifier ("ไปกลับ 80") merges into the previous item.
 */
export function splitRecap(input: string): string[] {
  // normalizeText collapses newlines — keep them as item separators first.
  const text = normalizeText(input.replace(/\r?\n+/g, " ; "));
  if (!text) return [];
  const masked = maskNonAmounts(text);

  // Hard separators (newline, ;, a comma that isn't a thousands separator).
  const cuts = new Set<number>();
  for (const m of masked.matchAll(/\n|;|,(?!\d{3}(?!\d))/g)) cuts.add(m.index! + m[0].length);
  // Each real amount ends an item.
  for (const m of masked.matchAll(AMOUNT_PATTERN)) {
    const end = m.index! + m[0].length;
    if (isQuantity(masked, end)) continue;
    cuts.add(end);
  }

  const raw: string[] = [];
  let start = 0;
  for (const cut of [...cuts].sort((a, b) => a - b)) {
    raw.push(text.slice(start, cut));
    start = cut;
  }
  raw.push(text.slice(start));

  const items: string[] = [];
  for (const piece of raw) {
    let cleaned = stripLeading(piece.replace(/^[\s,;]+|[\s,;]+$/g, ""), [...PREAMBLES, ...LEADING_CONNECTORS]);
    if (!cleaned) continue;
    // "ข้าว 40 จ่ายเงินสด แล้วก็กาแฟ 60": the payment words after an amount
    // describe THAT item — move them back before parsing this one.
    const lead = items.length > 0 ? PAYMENT_LEADS.find((p) => cleaned.toLowerCase().startsWith(p)) : undefined;
    if (lead) {
      const connector = CONNECTOR_INSIDE.exec(cleaned);
      const nextSpace = cleaned.indexOf(" ", lead.length);
      const cutAt = connector ? connector.index : nextSpace >= 0 ? nextSpace : cleaned.length;
      items[items.length - 1] = `${items[items.length - 1]} ${cleaned.slice(0, cutAt).trim()}`;
      cleaned = stripLeading(cleaned.slice(cutAt), LEADING_CONNECTORS);
      if (!cleaned) continue;
    }
    const hasAmount = [...cleaned.matchAll(AMOUNT_PATTERN)].length > 0;
    const prev = items.length - 1;
    if (!hasAmount && prev >= 0) {
      // Trailing qualifier ("จ่ายเงินสด") — part of the previous item.
      items[prev] = `${items[prev]} ${cleaned}`;
      continue;
    }
    if (hasAmount && prev >= 0 && MERGE_MODIFIERS.includes(labelOf(cleaned))) {
      // "ไปกลับ 80" replaces the previous amount: drop the old price so the
      // item reads "วินมอไซต์ ไปกลับ 80", not "วินมอไซต์ 40 ไปกลับ 80".
      const withoutOldPrice = items[prev].replace(AMOUNT_PATTERN, " ").replace(/\s+/g, " ").trim();
      items[prev] = `${withoutOldPrice} ${cleaned}`;
      continue;
    }
    items.push(cleaned);
  }
  return items;
}

const DATE_WORDS = ["เมื่อวานซืน", "เมื่อวาน", "yesterday"];

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Parses a recap into items. A date word in the FIRST item ("เมื่อวาน กิน
 * ข้าว 40 น้ำ 10") applies to every later item that has none of its own.
 */
export function parseRecap(input: string, ctx: ParseContext): RecapItem[] {
  const segments = splitRecap(input);
  if (segments.length === 0) return [];
  const firstLower = segments[0].toLowerCase();
  const recapDayShift = firstLower.includes("เมื่อวานซืน") ? -2 : firstLower.includes("เมื่อวาน") || firstLower.includes("yesterday") ? -1 : 0;

  return segments.map((segment, i) => {
    const ownDate = DATE_WORDS.some((w) => segment.toLowerCase().includes(w));
    const segmentCtx = i > 0 && !ownDate && recapDayShift !== 0 ? { ...ctx, today: shiftIso(ctx.today, recapDayShift) } : ctx;
    return { ...parseCaptureText(segment, segmentCtx), key: `recap-${i}`, sourceText: segment };
  });
}

/** True when the text holds two or more priced items — the trigger for the recap list instead of the single preview. */
export function isMultiItemRecap(items: RecapItem[]): boolean {
  return items.filter((item) => item.amountCents !== null).length >= 2;
}

export interface RecapTotals {
  expenseCount: number;
  expenseCents: number;
  incomeCount: number;
  incomeCents: number;
}

export function recapTotals(items: { type: "expense" | "income"; amountCents: number | null }[]): RecapTotals {
  const totals: RecapTotals = { expenseCount: 0, expenseCents: 0, incomeCount: 0, incomeCents: 0 };
  for (const item of items) {
    if (item.amountCents === null) continue;
    if (item.type === "income") {
      totals.incomeCount += 1;
      totals.incomeCents += item.amountCents;
    } else {
      totals.expenseCount += 1;
      totals.expenseCents += item.amountCents;
    }
  }
  return totals;
}
