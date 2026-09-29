"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { captureError } from "@/lib/observability";
import { friendlyDbError } from "@/lib/db-error";
import { centsToDecimalString, parseMoneyToCents } from "@/lib/financial/money";
import { detectSubscriptions } from "@/lib/financial/subscription-detector";
import { normalizeMerchant, parseCaptureText } from "@/lib/capture/transaction-parser";
import { todayInTimeZone } from "@/lib/date";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAIUsageStatus } from "@/lib/billing/ai-usage";
import { getAIProvider } from "@/features/ai/lib/provider";
import type { AIImageMediaType } from "@/features/ai/types";
import {
  captureSaveSchema,
  duplicateCheckSchema,
  type CaptureSaveInput,
  type DuplicateCheckInput,
} from "@/lib/validation/capture";
import { AIReceiptParser, MockReceiptParser, type ReceiptParser } from "./lib/receipt-parser";
import { learnMerchantCategory } from "./learning";
import type { ReceiptExtraction } from "@/lib/capture/receipt-normalize";
import type { CaptureMerchantPreference } from "@/lib/capture/transaction-parser";
import { SCAN_ACCEPTED_TYPES, SCAN_MAX_UPLOAD_BYTES } from "@/lib/capture/scan-upload";
import { isUndecidedCategory } from "@/lib/capture/inbox";
import {
  AI_ASSIST_MAX_TEXT,
  buildAIParseSystemPrompt,
  needsAIAssist,
  normalizeAIParseOutput,
  type AIParseFields,
} from "@/lib/capture/ai-fallback";

const PG_UNIQUE_VIOLATION = "23505";
const PG_UNDEFINED_COLUMN = "42703";
const PG_CHECK_VIOLATION = "23514";
const POSTGREST_UNKNOWN_COLUMN = "PGRST204";

/**
 * True when an error means "migration 0021 isn't applied to this database
 * yet" — an unknown column, or the old `source` check rejecting a new value.
 * The caller then retries in pre-0021 shape so capturing never breaks.
 */
function isPreMigrationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === PG_UNDEFINED_COLUMN || error.code === POSTGREST_UNKNOWN_COLUMN) return true;
  return error.code === PG_CHECK_VIOLATION && /source/i.test(error.message ?? "");
}

async function getRequestContext() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return { dict: getDictionary(locale), timezone: profile?.timezone ?? "Asia/Bangkok" };
}

function revalidateMoney() {
  revalidatePath("/money/transactions");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// merchant → category learning
// ---------------------------------------------------------------------------

/** The user's learned merchant → category mappings (empty before migration 0021). */
export async function getCapturePreferences(): Promise<CaptureMerchantPreference[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("merchant_category_preferences")
    .select("merchant_normalized, category_id")
    .order("usage_count", { ascending: false })
    .limit(500);
  if (error) return [];
  return data ?? [];
}

// ---------------------------------------------------------------------------
// recurring suggestion
// ---------------------------------------------------------------------------

export interface RecurringSuggestion {
  merchant: string;
  amountCents: number;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
}

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/**
 * Reuses the existing subscription detector on this merchant's history.
 * Suggests only — never creates anything — and stays quiet when the user
 * already set it up or said "not recurring" before (persisted in
 * detected_subscriptions, the same place the Subscriptions screen keeps
 * dismissals).
 */
async function findRecurringSuggestion(userId: string, merchantLabel: string | null): Promise<RecurringSuggestion | null> {
  if (!merchantLabel || merchantLabel.trim().length < 2) return null;
  const label = merchantLabel.trim();
  try {
    const supabase = await createClient();
    const since = new Date();
    since.setDate(since.getDate() - 400);
    const pattern = escapeIlike(label);
    const { data: history } = await supabase
      .from("transactions")
      .select("amount, transaction_date")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("transaction_date", since.toISOString().slice(0, 10))
      .or(`merchant.ilike.${pattern},description.ilike.${pattern}`)
      .limit(60);
    if (!history || history.length < 2) return null;

    const [candidate] = detectSubscriptions(
      history.map((t) => ({
        merchant: label,
        amountCents: parseMoneyToCents(t.amount),
        date: new Date(`${t.transaction_date}T00:00:00`),
      }))
    );
    if (!candidate || candidate.confidence === "low") return null;

    const [{ data: decided }, { data: recurring }] = await Promise.all([
      supabase
        .from("detected_subscriptions")
        .select("status")
        .eq("user_id", userId)
        .ilike("merchant", pattern)
        .in("status", ["dismissed", "confirmed", "cancelled"])
        .limit(1),
      supabase
        .from("recurring_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .or(`merchant.ilike.${pattern},description.ilike.${pattern}`)
        .limit(1),
    ]);
    if (decided?.length || recurring?.length) return null;

    return { merchant: label, amountCents: candidate.estimatedAmountCents, frequency: candidate.frequency };
  } catch {
    return null;
  }
}

/** "ไม่ใช่" on the recurring prompt — remembered so it never asks again for this merchant. */
export async function dismissRecurringSuggestion(suggestion: RecurringSuggestion): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };
  const today = todayInTimeZone();
  const { error } = await supabase.from("detected_subscriptions").upsert(
    {
      user_id: user.id,
      merchant: suggestion.merchant.slice(0, 120),
      estimated_amount: centsToDecimalString(suggestion.amountCents),
      frequency: suggestion.frequency,
      confidence: "medium",
      status: "dismissed",
      first_seen_date: today,
      last_seen_date: today,
    },
    { onConflict: "user_id,merchant" }
  );
  return { success: !error };
}

// ---------------------------------------------------------------------------
// save
// ---------------------------------------------------------------------------

export interface CaptureSaveResult {
  success?: boolean;
  error?: string;
  transactionId?: string;
  recurringSuggestion?: RecurringSuggestion | null;
}

/**
 * Saves one confirmed Quick Capture result as a real transaction.
 * Idempotent on `clientRequestId` (same mechanism as createTransaction —
 * see CLAUDE.md "TRANSACTION IDEMPOTENCY"): a retried tap never creates a
 * second row. Anything guessed (fallback category / not-high confidence)
 * lands in the Daily Inbox as `needs_review` instead of blocking the save.
 */
export async function saveCapturedTransaction(input: CaptureSaveInput): Promise<CaptureSaveResult> {
  const { dict } = await getRequestContext();
  const parsed = captureSaveSchema.safeParse(input);
  if (!parsed.success) return { error: dict.common.invalidInput };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const reviewStatus = d.confidence === "high" || d.categoryConfirmedByUser ? "confirmed" : "needs_review";
  const base = {
    user_id: user.id,
    type: d.type,
    account_id: d.accountId,
    category_id: d.categoryId,
    amount: centsToDecimalString(d.amountCents),
    transaction_date: d.date,
    description: d.description || null,
    merchant: d.merchant || null,
    client_request_id: d.clientRequestId,
  };

  // RLS re-validates account/category ownership on insert (0001's
  // transactions_insert_own) — user_id always comes from the session.
  let { data, error } = await supabase
    .from("transactions")
    .insert({
      ...base,
      source: d.source,
      review_status: reviewStatus,
      ai_confidence: d.confidence,
      reference: d.reference || null,
    })
    .select("id")
    .single();

  if (isPreMigrationError(error)) {
    ({ data, error } = await supabase
      .from("transactions")
      .insert({ ...base, source: "manual" })
      .select("id")
      .single());
  }

  if (error && error.code === PG_UNIQUE_VIOLATION) {
    // Same capture already saved (a retried tap) — look it up, succeed quietly.
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("client_request_id", d.clientRequestId)
      .maybeSingle();
    revalidateMoney();
    return { success: true, transactionId: existing?.id };
  }
  if (error || !data) {
    return {
      error: error ? friendlyDbError(error, "saveCapturedTransaction", dict.capture.saveFailed) : dict.capture.saveFailed,
    };
  }

  // Learn only from categories that weren't a blind fallback, or that the
  // user explicitly chose.
  if (reviewStatus === "confirmed") {
    await learnMerchantCategory(user.id, d.merchant || d.description, d.categoryId);
  }

  const recurringSuggestion =
    d.type === "expense" ? await findRecurringSuggestion(user.id, d.merchant || d.description) : null;

  revalidateMoney();
  return { success: true, transactionId: data.id, recurringSuggestion };
}

// ---------------------------------------------------------------------------
// Daily Inbox
// ---------------------------------------------------------------------------

/** ✓ in the Daily Inbox: marks reviewed, optionally with a corrected category, and learns from it. */
export async function confirmInboxTransaction(
  transactionId: string,
  categoryId?: string | null
): Promise<{ success?: boolean; error?: string }> {
  const { dict } = await getRequestContext();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const patch: { review_status: "confirmed"; category_id?: string | null } = { review_status: "confirmed" };
  if (categoryId !== undefined) patch.category_id = categoryId;

  const { data, error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .select("merchant, description, category_id")
    .single();
  if (error || !data) {
    return {
      error: error ? friendlyDbError(error, "confirmInboxTransaction", dict.capture.saveFailed) : dict.capture.saveFailed,
    };
  }

  // Learn only from a real choice: a category the user just picked, or one
  // that isn't the parser's blind "Other" fallback. Confirming a guessed
  // "Other" as-is must not teach it — the merchant would then come back as
  // a confident, auto-confirmed "Other" forever and never reach review.
  let learnable = categoryId !== undefined;
  if (!learnable && data.category_id) {
    const { data: category } = await supabase
      .from("categories")
      .select("id, name_en, is_system")
      .eq("id", data.category_id)
      .maybeSingle();
    learnable = Boolean(category) && !isUndecidedCategory(data.category_id, category ? [category] : []);
  }
  if (learnable) await learnMerchantCategory(user.id, data.merchant || data.description, data.category_id);
  revalidateMoney();
  return { success: true };
}

// ---------------------------------------------------------------------------
// duplicate protection
// ---------------------------------------------------------------------------

export interface PossibleDuplicate {
  id: string;
  amount: string;
  transaction_date: string;
  description: string | null;
  merchant: string | null;
}

/**
 * Likely-duplicate check before saving a scanned slip: same reference
 * number (strongest), or same amount within ±1 day with a matching
 * merchant (or no merchant to compare). Two genuinely separate identical
 * purchases are still allowed — the UI offers "save anyway".
 */
export async function checkCaptureDuplicate(input: DuplicateCheckInput): Promise<PossibleDuplicate | null> {
  const parsed = duplicateCheckSchema.safeParse(input);
  if (!parsed.success) return null;
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const columns = "id, amount, transaction_date, description, merchant";

  if (d.reference) {
    const { data, error } = await supabase
      .from("transactions")
      .select(columns)
      .eq("user_id", user.id)
      .eq("reference", d.reference)
      .limit(1);
    if (!error && data?.[0]) return data[0];
  }

  const center = new Date(`${d.date}T00:00:00Z`);
  const from = new Date(center.getTime() - 86_400_000).toISOString().slice(0, 10);
  const to = new Date(center.getTime() + 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("transactions")
    .select(columns)
    .eq("user_id", user.id)
    .eq("amount", centsToDecimalString(d.amountCents))
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .limit(10);
  if (!data?.length) return null;
  if (!d.merchant) return data[0];
  const key = normalizeMerchant(d.merchant);
  return (
    data.find((t) => {
      const other = normalizeMerchant(t.merchant || t.description || "");
      return !other || other.includes(key) || key.includes(other);
    }) ?? null
  );
}

// ---------------------------------------------------------------------------
// receipt / payment-slip scan
// ---------------------------------------------------------------------------

export type ReceiptScanResult =
  | { status: "ok"; extraction: ReceiptExtraction; mock?: boolean }
  | { status: "unavailable" | "failed" | "limit" | "invalid"; message: string };

// Kept in sync with the browser-side prep (scan-upload.ts): the Server
// Action body limit (1 MB) is the real ceiling, not the old 5 MB figure.
const MAX_SCAN_BYTES = SCAN_MAX_UPLOAD_BYTES;
const SCAN_MEDIA_TYPES: readonly AIImageMediaType[] = SCAN_ACCEPTED_TYPES;

function getReceiptParser(): ReceiptParser | null {
  if (process.env.CAPTURE_OCR_MOCK === "1") return new MockReceiptParser();
  const provider = getAIProvider();
  return provider ? new AIReceiptParser(provider) : null;
}

/**
 * Reads a receipt / payment slip image. The image is processed in memory
 * only — never written to storage or logged — and the result is only a
 * SUGGESTION: nothing is saved until the user confirms the preview.
 * Metered like one AI Money Coach message (same monthly plan quota).
 */
export async function scanReceipt(formData: FormData): Promise<ReceiptScanResult> {
  const { dict, timezone } = await getRequestContext();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "invalid", message: dict.common.pleaseLogin };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { status: "invalid", message: dict.capture.scanInvalid };
  if (file.size > MAX_SCAN_BYTES) return { status: "invalid", message: dict.capture.scanTooLarge };
  if (!SCAN_MEDIA_TYPES.includes(file.type as AIImageMediaType)) {
    return { status: "invalid", message: dict.capture.scanInvalid };
  }

  const parser = getReceiptParser();
  if (!parser) return { status: "unavailable", message: dict.capture.scanUnavailable };

  const burst = await checkRateLimit(`capture-scan:user:${user.id}`, { windowSeconds: 60, maxRequests: 8 });
  if (!burst.allowed) return { status: "limit", message: dict.capture.scanRateLimited };

  const isMock = process.env.CAPTURE_OCR_MOCK === "1";
  if (!isMock) {
    const usage = await getAIUsageStatus(user.id);
    if (usage.limitReached) return { status: "limit", message: dict.capture.scanLimitReached };
  }

  try {
    const base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await parser.parse(
      { mediaType: file.type as AIImageMediaType, base64Data },
      todayInTimeZone(timezone)
    );
    if (result.usage) {
      await supabase.from("ai_usage_log").insert({
        user_id: user.id,
        model: result.usage.model,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
      });
    }
    return { status: "ok", extraction: result.extraction, mock: result.mock };
  } catch (error) {
    // Never include the image or its contents in logs.
    captureError(error, { route: "capture.scanReceipt", operation: "parse_receipt" });
    return { status: "failed", message: dict.capture.scanFailed };
  }
}

// ---------------------------------------------------------------------------
// hybrid parsing — AI fallback for sentences the rules can't fully read
// ---------------------------------------------------------------------------

export type CaptureAssistResult =
  | { status: "ok"; fields: AIParseFields | null }
  | { status: "unavailable" | "limit" | "invalid" | "failed" | "not_needed" };

/**
 * One AI reading of a Quick Capture sentence. The client checks
 * `needsAIAssist()` for responsiveness, and this public Server Action repeats
 * that decision from trusted server-fetched context so a direct call cannot
 * spend quota on a simple deterministic sentence. The
 * result is a SUGGESTION validated against the user's own text
 * (normalizeAIParseOutput) and merged client-side; nothing is saved here.
 * Metered like one AI Money Coach message; burst rate-limited.
 */
export async function assistCaptureParse(text: string): Promise<CaptureAssistResult> {
  const input = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (!input || input.length > AI_ASSIST_MAX_TEXT) return { status: "invalid" };

  const { timezone } = await getRequestContext();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "invalid" };

  const today = todayInTimeZone(timezone);
  const [categoriesResult, accountsResult, preferencesResult] = await Promise.all([
    supabase.from("categories").select("id, name_th, name_en, type, icon, is_system"),
    supabase
      .from("accounts")
      .select("id, name, account_type, institution, is_archived")
      .eq("is_archived", false),
    supabase
      .from("merchant_category_preferences")
      .select("merchant_normalized, category_id")
      .order("usage_count", { ascending: false })
      .limit(500),
  ]);
  if (categoriesResult.error || accountsResult.error || preferencesResult.error) return { status: "failed" };

  const categories = categoriesResult.data ?? [];
  const local = parseCaptureText(input, {
    today,
    categories,
    accounts: accountsResult.data ?? [],
    merchantPreferences: preferencesResult.data ?? [],
  });
  if (!needsAIAssist(input, local)) return { status: "not_needed" };

  const provider = getAIProvider();
  if (!provider) return { status: "unavailable" };

  const burst = await checkRateLimit(`capture-assist:user:${user.id}`, { windowSeconds: 60, maxRequests: 10 });
  if (!burst.allowed) return { status: "limit" };
  const usage = await getAIUsageStatus(user.id);
  if (usage.limitReached) return { status: "limit" };

  try {
    const result = await provider.generate({
      system: buildAIParseSystemPrompt(today, categories),
      maxTokens: 300,
      messages: [{ role: "user", content: input }],
    });
    await supabase.from("ai_usage_log").insert({
      user_id: user.id,
      model: result.model,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
    });
    return { status: "ok", fields: normalizeAIParseOutput(result.content, { text: input, today, categories }) };
  } catch (error) {
    // Never log the sentence itself — it's the user's financial data.
    captureError(error, { route: "capture.assistCaptureParse", operation: "ai_parse" });
    return { status: "failed" };
  }
}
