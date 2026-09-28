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

/**
 * Normalizes a model date to YYYY-MM-DD. Thai slips print Buddhist-era
 * years (2569 = 2026 CE) — converted here rather than trusting the model to
 * have done it. Dates in the future or implausibly old are dropped (the UI
 * then defaults to today and lets the user change it).
 */
export function normalizeReceiptDate(value: string | null | undefined, today: string): string | null {
  const raw = cleanString(value, 20);
  if (!raw) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (!m) return null;
  let year = Number(m[1]);
  if (year > 2400) year -= 543;
  const month = Number(m[2]);
  const day = Number(m[3]);
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
  let confidence: CaptureConfidence = d.confidence;
  if (amountCents === null) confidence = "low";
  else if (!merchant && confidence === "high") confidence = "medium";

  return {
    isPaymentDocument: d.is_payment_document !== false,
    amountCents,
    date: normalizeReceiptDate(d.date, today),
    time: time && /^\d{1,2}:\d{2}$/.test(time) ? time : null,
    merchant,
    paymentMethod: cleanString(d.payment_method, 60),
    reference: cleanString(d.reference, 80),
    confidence,
  };
}
