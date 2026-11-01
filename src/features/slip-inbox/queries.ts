import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isMissingSlipColumn } from "@/lib/capture/slip-inbox";
import type { CaptureToken, SlipInboxRow } from "@/types/database";

export type PendingSlip = Pick<
  SlipInboxRow,
  | "id"
  | "origin"
  | "amount"
  | "slip_date"
  | "slip_time"
  | "merchant"
  | "payment_method"
  | "reference"
  | "account_id"
  | "category_id"
  | "confidence"
  | "possible_duplicate_of"
  | "created_at"
  | "note"
> & {
  payer_account?: string | null;
  sender_name?: string | null;
  sender_bank?: string | null;
  receiver_account?: string | null;
  receiver_bank?: string | null;
  to_account_id?: string | null;
};

const PENDING_COLUMNS =
  "id, origin, amount, slip_date, slip_time, merchant, payment_method, reference, account_id, category_id, confidence, possible_duplicate_of, created_at";
const MOVEMENT_COLUMNS = "payer_account, sender_name, sender_bank, receiver_account, receiver_bank, to_account_id";

/**
 * Slips waiting for the user, newest first — or null when the slip inbox
 * can't load (e.g. migration 0046 not applied yet), so pages simply leave it
 * out instead of erroring. RLS scopes this to the signed-in user. Before
 * migration 0047 the memo column doesn't exist; slips then show without one.
 */
export async function getPendingSlips(): Promise<PendingSlip[] | null> {
  const supabase = await createClient();
  const query = (columns: string) =>
    supabase
      .from("slip_inbox")
      .select(columns)
      .eq("status", "pending")
      .order("slip_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100);
  let { data, error } = await query(`${PENDING_COLUMNS}, note, ${MOVEMENT_COLUMNS}`);
  if (isMissingSlipColumn(error)) ({ data, error } = await query(`${PENDING_COLUMNS}, note`));
  if (isMissingSlipColumn(error)) ({ data, error } = await query(PENDING_COLUMNS));
  if (error || !data) return null;
  return (data as unknown as PendingSlip[]).map((s) => ({ ...s, note: s.note ?? null }));
}

export type CaptureTokenSummary = Pick<CaptureToken, "id" | "label" | "token_hint" | "last_used_at" | "created_at">;

/** The user's live Shortcut keys (never the key itself — only its last characters). Null before migration 0046. */
export async function getCaptureTokens(): Promise<CaptureTokenSummary[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capture_tokens")
    .select("id, label, token_hint, last_used_at, created_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return null;
  return data as CaptureTokenSummary[];
}
