"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { friendlyDbError } from "@/lib/db-error";
import { todayInTimeZone } from "@/lib/date";
import { checkRateLimit } from "@/lib/rate-limit";
import { SCAN_ACCEPTED_TYPES, SCAN_MAX_UPLOAD_BYTES } from "@/lib/capture/scan-upload";
import {
  MAX_ACTIVE_CAPTURE_TOKENS,
  captureTokenHint,
  captureTokenLabelSchema,
  generateCaptureToken,
  isMissingSlipColumn,
  samePayer,
  sha256Hex,
  slipConfirmSchema,
  slipPayer,
  type SlipConfirmInput,
} from "@/lib/capture/slip-inbox";
import { saveCapturedTransaction } from "@/features/capture/actions";
import type { AIImageMediaType } from "@/features/ai/types";
import type { CaptureConfidence } from "@/types/database";
import { ingestSlipImage, type SlipIngestStatus } from "./ingest";

async function context() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return { dict: getDictionary(locale), timezone: profile?.timezone ?? "Asia/Bangkok" };
}

function revalidateSlips() {
  revalidatePath("/money/transactions");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// capture tokens (Profile › ส่งสลิปอัตโนมัติ)
// ---------------------------------------------------------------------------

export type CreateTokenResult = { token: string; id: string } | { error: string };

/**
 * Creates a personal key for the iPhone Shortcut. The full key is returned
 * ONCE, here — only its SHA-256 is stored, so it can never be shown again.
 */
export async function createCaptureToken(label: string): Promise<CreateTokenResult> {
  const { dict } = await context();
  const parsedLabel = captureTokenLabelSchema.safeParse(label);
  if (!parsedLabel.success) return { error: dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { count } = await supabase
    .from("capture_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_ACTIVE_CAPTURE_TOKENS) return { error: dict.slipInbox.tokens.tooMany };

  const token = generateCaptureToken();
  const { data, error } = await supabase
    .from("capture_tokens")
    .insert({ user_id: user.id, label: parsedLabel.data, token_hash: sha256Hex(token), token_hint: captureTokenHint(token) })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error ? friendlyDbError(error, "createCaptureToken", dict.slipInbox.notReady) : dict.slipInbox.notReady };
  }
  revalidatePath("/profile/slip-shortcut");
  return { token, id: data.id };
}

export async function revokeCaptureToken(tokenId: string): Promise<{ success?: boolean; error?: string }> {
  const { dict } = await context();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };
  const { error } = await supabase
    .from("capture_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if (error) return { error: friendlyDbError(error, "revokeCaptureToken", dict.slipInbox.saveFailed) };
  revalidatePath("/profile/slip-shortcut");
  return { success: true };
}

// ---------------------------------------------------------------------------
// bulk upload (many slips picked at once in the app)
// ---------------------------------------------------------------------------

export interface UploadSlipResult {
  status: SlipIngestStatus | "invalid";
}

/**
 * One slip of a multi-select upload → the slip inbox. Called once per image
 * by the client (each stays under the 1 MB Server Action body). Nothing is
 * saved as a transaction here.
 */
export async function uploadSlipImage(formData: FormData): Promise<UploadSlipResult> {
  const { timezone } = await context();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "invalid" };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0 || file.size > SCAN_MAX_UPLOAD_BYTES) return { status: "invalid" };
  if (!(SCAN_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return { status: "invalid" };

  const burst = await checkRateLimit(`slip-upload:user:${user.id}`, { windowSeconds: 60, maxRequests: 30 });
  if (!burst.allowed) return { status: "limit" };

  const result = await ingestSlipImage(supabase, {
    userId: user.id,
    image: { bytes: new Uint8Array(await file.arrayBuffer()), mediaType: file.type as AIImageMediaType },
    origin: "upload",
    today: todayInTimeZone(timezone),
  });
  if (result.status === "queued") revalidateSlips();
  return { status: result.status };
}

// ---------------------------------------------------------------------------
// confirm / dismiss
// ---------------------------------------------------------------------------

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * "Slips paid from this bank/card come from this account": remembered as a
 * learned nickname on the account (account_aliases, 0041) — the user can see
 * and remove it in the account's nicknames. Then every OTHER waiting slip
 * from the same payer is pointed at that account too, so fixing one fixes
 * the rest. Best-effort: the transaction is already saved, so a failure here
 * only means the next slip isn't pre-filled. Returns how many waiting slips
 * were re-pointed.
 */
async function rememberSlipPayer(
  supabase: Db,
  userId: string,
  slip: { id: string; payment_method: string | null; payer_account?: string | null },
  accountId: string
): Promise<number> {
  const payer = slipPayer(slip.payment_method, slip.payer_account ?? null);
  if (!payer) return 0;

  // The specific name ("kbank 8710") plus the bank alone, so a slip whose
  // digits are unreadable still finds the account.
  const remember = [
    ...(payer.specific ? [{ key: payer.specific, label: payer.label }] : []),
    { key: payer.bank, label: (slip.payment_method ?? payer.bank).trim().slice(0, 60) },
  ];
  for (const { key, label } of remember) {
    await supabase
      .from("account_aliases")
      .upsert(
        { user_id: userId, account_id: accountId, alias: label, alias_normalized: key, source: "learned" },
        { onConflict: "user_id,alias_normalized" }
      );
  }

  const waitingQuery = (columns: string) =>
    supabase.from("slip_inbox").select(columns).eq("user_id", userId).eq("status", "pending");
  let waiting = await waitingQuery("id, payment_method, payer_account, account_id");
  if (isMissingSlipColumn(waiting.error)) waiting = await waitingQuery("id, payment_method, account_id");
  if (waiting.error || !waiting.data) return 0;

  const rows = waiting.data as unknown as {
    id: string;
    payment_method: string | null;
    payer_account?: string | null;
    account_id: string | null;
  }[];
  const ids = rows
    .filter((w) => w.id !== slip.id && w.account_id !== accountId)
    .filter((w) => samePayer(payer, slipPayer(w.payment_method, w.payer_account ?? null)))
    .map((w) => w.id);
  if (ids.length === 0) return 0;
  const { error: updateError } = await supabase
    .from("slip_inbox")
    .update({ account_id: accountId })
    .eq("user_id", userId)
    .eq("status", "pending")
    .in("id", ids);
  return updateError ? 0 : ids.length;
}

/**
 * ✓ on a waiting slip: saves it as a real transaction through the normal
 * capture save (idempotent — the slip id is the client_request_id, so a
 * retried tap never creates a second transaction), then marks the slip
 * confirmed. This is the first moment the slip touches a balance. The
 * slip's memo becomes the description; the chosen account is remembered for
 * this payer (rememberSlipPayer).
 */
export async function confirmSlip(
  input: SlipConfirmInput
): Promise<{ success?: boolean; error?: string; repointed?: number }> {
  const { dict } = await context();
  const parsed = slipConfirmSchema.safeParse(input);
  if (!parsed.success) return { error: dict.common.invalidInput };
  const d = parsed.data;
  if (!d.categoryId) return { error: dict.slipInbox.pickCategory };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const slipQuery = (columns: string) =>
    supabase.from("slip_inbox").select(columns).eq("id", d.slipId).eq("user_id", user.id).maybeSingle();
  let found = await slipQuery("id, status, reference, confidence, payment_method, payer_account");
  if (isMissingSlipColumn(found.error)) found = await slipQuery("id, status, reference, confidence, payment_method");
  const slip = found.data as unknown as {
    id: string;
    status: string;
    reference: string | null;
    confidence: string;
    payment_method: string | null;
    payer_account?: string | null;
  } | null;
  if (!slip) return { error: dict.slipInbox.notFound };
  if (slip.status === "confirmed") return { success: true };
  if (slip.status !== "pending") return { error: dict.slipInbox.notFound };

  const saved = await saveCapturedTransaction({
    clientRequestId: slip.id,
    type: "expense",
    amountCents: d.amountCents,
    accountId: d.accountId,
    categoryId: d.categoryId,
    merchant: d.merchant || null,
    description: d.note || null,
    date: d.date,
    source: "receipt",
    confidence: slip.confidence as CaptureConfidence,
    reference: slip.reference,
    // The user looked at this slip and accepted (or chose) its category.
    categoryConfirmedByUser: true,
  });
  if (!saved.success) return { error: saved.error ?? dict.slipInbox.saveFailed };

  const { error } = await supabase
    .from("slip_inbox")
    .update({ status: "confirmed", transaction_id: saved.transactionId ?? null })
    .eq("id", slip.id)
    .eq("user_id", user.id);
  // The transaction exists either way; a retry finds it via its idempotency key.
  if (error) return { error: friendlyDbError(error, "confirmSlip", dict.slipInbox.saveFailed) };
  const repointed = await rememberSlipPayer(supabase, user.id, slip, d.accountId);
  revalidateSlips();
  return repointed > 0 ? { success: true, repointed } : { success: true };
}

/** "Not this one": hidden for good (and never re-read if the Shortcut sends it again). */
export async function dismissSlip(slipId: string): Promise<{ success?: boolean; error?: string }> {
  const { dict } = await context();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };
  const { error } = await supabase
    .from("slip_inbox")
    .update({ status: "dismissed" })
    .eq("id", slipId)
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (error) return { error: friendlyDbError(error, "dismissSlip", dict.slipInbox.saveFailed) };
  revalidateSlips();
  return { success: true };
}

/** Undo for a dismiss (the swipe's undo toast). */
export async function restoreSlip(slipId: string): Promise<{ success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  const { error } = await supabase
    .from("slip_inbox")
    .update({ status: "pending" })
    .eq("id", slipId)
    .eq("user_id", user.id)
    .eq("status", "dismissed");
  if (!error) revalidateSlips();
  return { success: !error };
}
