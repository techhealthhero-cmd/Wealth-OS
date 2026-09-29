import { createHash } from "node:crypto";

import type { CaptureCategory, CaptureMerchantPreference } from "@/lib/capture/transaction-parser";
import { suggestCategory, normalizeMerchant } from "@/lib/capture/transaction-parser";
import type { ImportHeaderMapping } from "./csv";

export type ImportRowStatus = "ready" | "needs_review" | "duplicate" | "error";
export type ImportRowErrorCode =
  | "missing_date"
  | "invalid_date"
  | "missing_amount"
  | "invalid_amount"
  | "zero_amount"
  | "ambiguous_debit_credit"
  | "ambiguous_amount_sign"
  | "unknown_type"
  | "currency_mismatch";

export interface NormalizedImportRow {
  type: "income" | "expense";
  amount: string;
  amountCents: number;
  date: string;
  description: string;
  merchant: string;
  reference: string | null;
  currencyCode: string;
  categoryId: string | null;
  categorySource: "learned" | "keyword" | "ai" | "fallback" | null;
  reviewRequired: boolean;
  fingerprint: string;
}

export type NormalizeImportRowResult =
  | { status: "ready" | "needs_review"; normalized: NormalizedImportRow }
  | { status: "error"; errorCode: ImportRowErrorCode };

export interface NormalizeImportContext {
  accountId: string;
  accountCurrency: string;
  categories: CaptureCategory[];
  merchantPreferences: CaptureMerchantPreference[];
}

const TYPE_INCOME = new Set(["income", "credit", "deposit", "in", "รายรับ", "ฝาก", "เครดิต"]);
const TYPE_EXPENSE = new Set(["expense", "debit", "withdrawal", "withdraw", "out", "รายจ่าย", "ถอน", "เดบิต"]);

function cell(row: Record<string, string>, header: string | null | undefined): string {
  return header ? (row[header] ?? "").trim() : "";
}

function parseMoney(raw: string): { cents: number; negative: boolean } | null {
  const compact = raw.trim().replace(/[฿$€£¥\s]/g, "");
  if (!compact) return null;
  const parentheses = compact.startsWith("(") && compact.endsWith(")");
  const cleaned = compact.replace(/[(),]/g, "");
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  const negative = parentheses || value < 0;
  const cents = Math.round(Math.abs(value) * 100);
  return { cents, negative };
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return validIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/.exec(value);
  if (!local) return null;
  let year = Number(local[3]);
  if (year < 100) year += 2000;
  if (year >= 2400) year -= 543;
  return validIso(year, Number(local[2]), Number(local[1]));
}

function validIso(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function resolveTypeAndAmount(row: Record<string, string>, mapping: ImportHeaderMapping):
  | { type: "income" | "expense"; amountCents: number }
  | { errorCode: ImportRowErrorCode } {
  if (mapping.debit || mapping.credit) {
    const debitRaw = cell(row, mapping.debit);
    const creditRaw = cell(row, mapping.credit);
    const debit = parseMoney(debitRaw);
    const credit = parseMoney(creditRaw);
    const hasDebit = debitRaw !== "";
    const hasCredit = creditRaw !== "";
    if (hasDebit && hasCredit) return { errorCode: "ambiguous_debit_credit" };
    if (!hasDebit && !hasCredit) return { errorCode: "missing_amount" };
    const parsed = hasDebit ? debit : credit;
    if (!parsed) return { errorCode: "invalid_amount" };
    if (parsed.cents === 0) return { errorCode: "zero_amount" };
    return { type: hasDebit ? "expense" : "income", amountCents: parsed.cents };
  }

  const raw = cell(row, mapping.amount);
  if (!raw) return { errorCode: "missing_amount" };
  const parsed = parseMoney(raw);
  if (!parsed) return { errorCode: "invalid_amount" };
  if (parsed.cents === 0) return { errorCode: "zero_amount" };
  if (parsed.negative) return { type: "expense", amountCents: parsed.cents };
  const typeRaw = cell(row, mapping.type).toLowerCase();
  if (!typeRaw) return { errorCode: "ambiguous_amount_sign" };
  if (TYPE_INCOME.has(typeRaw)) return { type: "income", amountCents: parsed.cents };
  if (TYPE_EXPENSE.has(typeRaw)) return { type: "expense", amountCents: parsed.cents };
  return { errorCode: "unknown_type" };
}

function centsToAmount(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function createImportFingerprint(input: {
  accountId: string;
  currencyCode: string;
  date: string;
  amount: string;
  type: "income" | "expense";
  merchant: string;
}): string {
  return createHash("sha256")
    .update([
      input.accountId,
      input.currencyCode,
      input.date,
      input.amount,
      input.type,
      normalizeMerchant(input.merchant),
    ].join("|"))
    .digest("hex");
}

export function normalizeImportRow(
  row: Record<string, string>,
  mapping: ImportHeaderMapping,
  context: NormalizeImportContext
): NormalizeImportRowResult {
  const rawDate = cell(row, mapping.date);
  if (!rawDate) return { status: "error", errorCode: "missing_date" };
  const date = parseDate(rawDate);
  if (!date) return { status: "error", errorCode: "invalid_date" };

  const resolved = resolveTypeAndAmount(row, mapping);
  if ("errorCode" in resolved) return { status: "error", errorCode: resolved.errorCode };

  const rowCurrency = cell(row, mapping.currency).toUpperCase();
  const accountCurrency = context.accountCurrency.toUpperCase();
  if (rowCurrency && rowCurrency !== accountCurrency) return { status: "error", errorCode: "currency_mismatch" };

  const description = cell(row, mapping.description).slice(0, 200);
  const merchant = description.slice(0, 120);
  const reference = cell(row, mapping.reference).slice(0, 80) || null;
  const category = suggestCategory(description, merchant || null, resolved.type, {
    today: date,
    accounts: [],
    categories: context.categories,
    merchantPreferences: context.merchantPreferences,
  });
  const reviewRequired = !category.categoryId || category.source === "fallback";
  const amount = centsToAmount(resolved.amountCents);
  const normalized: NormalizedImportRow = {
    type: resolved.type,
    amount,
    amountCents: resolved.amountCents,
    date,
    description,
    merchant,
    reference,
    currencyCode: accountCurrency,
    categoryId: category.categoryId,
    categorySource: category.source,
    reviewRequired,
    fingerprint: createImportFingerprint({
      accountId: context.accountId,
      currencyCode: accountCurrency,
      date,
      amount,
      type: resolved.type,
      merchant,
    }),
  };
  return { status: reviewRequired ? "needs_review" : "ready", normalized };
}
