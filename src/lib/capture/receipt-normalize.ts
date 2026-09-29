import type { CaptureConfidence } from "@/types/database";
import { parseMoneyToCents } from "@/lib/financial/money";
import { receiptModelOutputSchema } from "@/lib/validation/capture";

/** What a receipt/payment-slip scan extracted. Every field may be missing. */
export interface ReceiptExtraction {
  isPaymentDocument: boolean;
  amountCents: number | null;
  date: string | null;
  time: string | null;
  merchant: string | null;
  paymentMethod: string | null;
  reference: string | null;
  confidence: CaptureConfidence;
}

export const EMPTY_EXTRACTION: ReceiptExtraction = {
  isPaymentDocument: false,
  amountCents: null,
  date: null,
  time: null,
  merchant: null,
  paymentMethod: null,
  reference: null,
  confidence: "low",
};

function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function cleanString(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || /^(null|unknown|n\/a|-)$/i.test(trimmed)) return null;
  return trimmed.slice(0, max);
}

function parseIsoParts(raw: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

// Abbreviations compared without dots/spaces ("ก.ย." → "กย").
const THAI_MONTH_ABBR = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"];
const THAI_MONTH_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/**
 * Thai slips print dates like "30 ก.ย. 69" / "30 ก.ย. 2569" / "30 กันยายน 2569",
 * and the model sometimes returns them as printed (found in live scans).
 * A Thai month name makes the order unambiguous. A 2-digit year after a Thai
 * month is the Buddhist-era short form (69 = 2569). Numeric-only formats like
 * "29/09/2026" stay rejected — day/month order can't be trusted.
 */
function parseThaiMonthParts(raw: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{1,2})\s*([฀-๿.\s]+?)\s*(\d{4}|\d{2})$/.exec(raw);
  if (!m) return null;
  const name = m[2].replace(/[.\s]/g, "");
  const idx = THAI_MONTH_ABBR.indexOf(name) >= 0 ? THAI_MONTH_ABBR.indexOf(name) : THAI_MONTH_FULL.indexOf(name);
  if (idx < 0) return null;
  const year = m[3].length === 2 ? 2500 + Number(m[3]) : Number(m[3]);
  return { year, month: idx + 1, day: Number(m[1]) };
}

/**
 * Normalizes a model date to YYYY-MM-DD. Thai slips print Buddhist-era
 * years (2569 = 2026 CE) — converted here rather than trusting the model to
 * have done it. Dates in the future or implausibly old are dropped (the UI
 * then defaults to today and lets the user change it).
 */
export function normalizeReceiptDate(value: string | null | undefined, today: string): string | null {
  const raw = cleanString(value, 24);
  if (!raw) return null;
  const parts = parseIsoParts(raw) ?? parseThaiMonthParts(raw);
  if (!parts) return null;
  let { year } = parts;
  if (year > 2400) year -= 543;
  const { month, day } = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return null;
  if (iso > today) return null;
  const [ty] = today.split("-").map(Number);
  if (year < ty - 2) return null;
  return iso;
}

function toAmountCents(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(/[฿,\s]|thb|baht|บาท/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  try {
    const cents = parseMoneyToCents(text);
    return cents > 0 && cents < 10 ** 15 ? cents : null;
  } catch {
    return null;
  }
}

/**
 * Turns a model's raw text reply into a validated ReceiptExtraction. Never
 * throws: anything unreadable becomes a missing field, and confidence is
 * capped when key fields are missing (the model's own "high" isn't trusted
 * for a result with no amount).
 */
export function normalizeReceiptModelOutput(rawText: string, today: string): ReceiptExtraction {
  const parsed = receiptModelOutputSchema.safeParse(firstJsonObject(rawText));
  if (!parsed.success) return EMPTY_EXTRACTION;
  const d = parsed.data;

  const amountCents = toAmountCents(d.amount ?? null);
  const merchant = cleanString(d.merchant, 120);
  const time = cleanString(d.time, 5);
  const date = normalizeReceiptDate(d.date, today);
  let confidence: CaptureConfidence = d.confidence;
  if (amountCents === null) confidence = "low";
  // No readable date means the preview silently falls back to "today" —
  // never "high" then, so the save lands in the Daily Inbox for a glance
  // instead of being auto-confirmed with a guessed date (found live: a
  // blurry slip came back "high" with its date unreadable).
  else if ((!merchant || !date) && confidence === "high") confidence = "medium";

  return {
    isPaymentDocument: d.is_payment_document !== false,
    amountCents,
    date,
    time: time && /^\d{1,2}:\d{2}$/.test(time) ? time : null,
    merchant,
    paymentMethod: cleanString(d.payment_method, 60),
    reference: cleanString(d.reference, 80),
    confidence,
  };
}
