import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { captureError } from "@/lib/observability";
import { centsToDecimalString, parseMoneyToCents } from "@/lib/financial/money";
import { getCurrentBillingPeriod } from "@/lib/billing/period";
import { getPlanLimit } from "@/lib/billing/plans";
import { resolvePlanFromSubscription } from "@/lib/billing/entitlements";
import { getReceiptParser } from "@/features/capture/lib/receipt-parser";
import type { AIImageMediaType } from "@/features/ai/types";
import type { Subscription, SlipInboxOrigin } from "@/types/database";
import {
  SLIP_DAILY_LIMIT,
  findPossibleDuplicate,
  sha256Hex,
  slipStatusFor,
  suggestSlipFields,
} from "@/lib/capture/slip-inbox";

/**
 * One slip image → one slip_inbox row (or a reason it isn't one). Shared by
 * the iPhone Shortcut endpoint (service-role client, no session) and the
 * in-app bulk upload (the user's own RLS client), so EVERY query here
 * filters by `userId` explicitly — with the service-role client that filter
 * is the only thing scoping the data, so it must never be left out.
 *
 * The image is processed in memory only — never stored, never logged. Only
 * its SHA-256 is kept, so a resend of the same photo is skipped before any
 * AI call (the Shortcut looks back a few days on purpose).
 */

// Deliberately loose: the admin client is untyped (lib/supabase/admin.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type SlipIngestStatus =
  | "queued" // waiting in the slip inbox
  | "not_slip" // not a payment slip
  | "duplicate" // its reference is already on a recorded transaction
  | "already" // this exact image (or reference) is already in the inbox
  | "limit" // daily slip ceiling reached
  | "quota" // monthly capture AI quota used up
  | "unavailable" // slip reading isn't enabled on this server
  | "failed";

export interface SlipIngestResult {
  status: SlipIngestStatus;
  slipId?: string;
}

export interface SlipIngestInput {
  userId: string;
  image: { bytes: Uint8Array; mediaType: AIImageMediaType };
  origin: SlipInboxOrigin;
  tokenId?: string | null;
  /** The user's local "today" (YYYY-MM-DD). */
  today: string;
}

const PG_UNIQUE_VIOLATION = "23505";

async function captureQuotaReached(db: Db, userId: string): Promise<boolean> {
  const { start, end } = getCurrentBillingPeriod();
  const [{ data: subscription }, { count, error }] = await Promise.all([
    db.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
    db
      .from("ai_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", "capture")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString()),
  ]);
  if (error) return false; // same fail-open as countAIUsageThisPeriod
  const plan = resolvePlanFromSubscription((subscription as Subscription | null) ?? null);
  const limit = getPlanLimit(plan, "aiCaptureAssistsPerMonth");
  return limit !== null && (count ?? 0) >= limit;
}

async function dailyLimitReached(db: Db, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error } = await db
    .from("slip_inbox")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return !error && (count ?? 0) >= SLIP_DAILY_LIMIT;
}

export async function ingestSlipImage(db: Db, input: SlipIngestInput): Promise<SlipIngestResult> {
  const { userId } = input;
  const imageSha = sha256Hex(input.image.bytes);

  const { data: seen } = await db
    .from("slip_inbox")
    .select("id")
    .eq("user_id", userId)
    .eq("image_sha256", imageSha)
    .limit(1);
  if (seen?.[0]) return { status: "already", slipId: seen[0].id as string };

  const parser = getReceiptParser();
  if (!parser) return { status: "unavailable" };
  if (await dailyLimitReached(db, userId)) return { status: "limit" };
  const isMock = process.env.CAPTURE_OCR_MOCK === "1";
  if (!isMock && (await captureQuotaReached(db, userId))) return { status: "quota" };

  try {
    const result = await parser.parse(
      { mediaType: input.image.mediaType, base64Data: Buffer.from(input.image.bytes).toString("base64") },
      input.today
    );
    if (result.usage) {
      await db.from("ai_usage_log").insert({
        user_id: userId,
        model: result.usage.model,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        feature: "capture",
      });
    }
    const x = result.extraction;

    const [accounts, categories, categoryPrefs, accountPrefs, byReference] = await Promise.all([
      db.from("accounts").select("id, name, account_type, institution, is_archived").eq("user_id", userId).eq("is_archived", false),
      db
        .from("categories")
        .select("id, name_th, name_en, type, icon, is_system")
        .or(`is_system.eq.true,user_id.eq.${userId}`),
      db
        .from("merchant_category_preferences")
        .select("merchant_normalized, category_id")
        .eq("user_id", userId)
        .order("usage_count", { ascending: false })
        .limit(500),
      // Missing before migration 0042 — then simply no shop accounts.
      db.from("merchant_account_preferences").select("merchant_normalized, account_id").eq("user_id", userId).limit(500),
      x.reference
        ? db.from("transactions").select("id").eq("user_id", userId).eq("reference", x.reference).limit(1)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);

    const status = slipStatusFor(x, Boolean(byReference.data?.[0]));
    const suggestion = suggestSlipFields(x, {
      accounts: accounts.data ?? [],
      categories: categories.data ?? [],
      merchantPreferences: categoryPrefs.data ?? [],
      merchantAccounts: accountPrefs.error ? [] : (accountPrefs.data ?? []),
      today: input.today,
    });

    let possibleDuplicateOf: string | null = null;
    if (status === "pending" && x.amountCents !== null) {
      const date = x.date ?? input.today;
      const day = Date.parse(`${date}T00:00:00Z`);
      const { data: near } = await db
        .from("transactions")
        .select("id, amount, transaction_date, merchant, description")
        .eq("user_id", userId)
        .eq("amount", centsToDecimalString(x.amountCents))
        .gte("transaction_date", new Date(day - 86_400_000).toISOString().slice(0, 10))
        .lte("transaction_date", new Date(day + 86_400_000).toISOString().slice(0, 10))
        .limit(10);
      possibleDuplicateOf = findPossibleDuplicate(
        { amountCents: x.amountCents, date, merchant: x.merchant },
        (near ?? []).map((t) => ({
          id: t.id as string,
          amountCents: parseMoneyToCents(t.amount as string),
          date: t.transaction_date as string,
          merchant: (t.merchant as string | null) ?? null,
          description: (t.description as string | null) ?? null,
        }))
      );
    }

    const keep = status === "pending";
    const { data: row, error } = await db
      .from("slip_inbox")
      .insert({
        user_id: userId,
        status,
        origin: input.origin,
        token_id: input.tokenId ?? null,
        image_sha256: imageSha,
        // A non-slip keeps nothing but its hash.
        amount: keep && x.amountCents !== null ? centsToDecimalString(x.amountCents) : null,
        slip_date: keep ? x.date : null,
        slip_time: keep ? x.time : null,
        merchant: keep ? x.merchant : null,
        payment_method: keep ? x.paymentMethod : null,
        // Kept on duplicates too: it's what makes a resend recognisable.
        reference: status === "not_slip" ? null : x.reference,
        account_id: keep ? suggestion.accountId : null,
        category_id: keep ? suggestion.categoryId : null,
        confidence: keep ? suggestion.confidence : "low",
        possible_duplicate_of: possibleDuplicateOf,
      })
      .select("id")
      .single();

    if (error?.code === PG_UNIQUE_VIOLATION) return { status: "already" };
    if (error || !row) throw error ?? new Error("slip_inbox insert returned no row");
    return { status: status === "pending" ? "queued" : status, slipId: row.id as string };
  } catch (error) {
    // Never include the image or what was read from it.
    captureError(error, { route: "slip-inbox.ingest", operation: "ingest_slip", userId, extra: { origin: input.origin } });
    return { status: "failed" };
  }
}
