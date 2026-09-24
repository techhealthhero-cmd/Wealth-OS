import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getTransactions } from "@/features/transactions/queries";
import { detectSubscriptions } from "@/lib/financial/subscription-detector";
import { parseMoneyToCents, centsToDecimalString } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import type { DetectedSubscription } from "@/types/database";
import { throwDbError } from "@/lib/db-error";

const LOOKBACK_DAYS = 365;

function lookbackRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - LOOKBACK_DAYS);
  return { from: toLocalDateString(from), to: toLocalDateString(now) };
}

/**
 * Runs the deterministic detector over the last year of expense
 * transactions, inserts any brand-new candidate as `pending`, and returns
 * every row from the database (the source of truth for status). Existing
 * rows are never overwritten here — a user's confirm/dismiss/cancel
 * decision on a merchant is permanent unless they change it themselves.
 *
 * Perf audit finding: this used to re-`select("*")` the entire table a
 * SECOND time after inserting, purely to return "the final list," and
 * wasn't `cache()`-wrapped despite `getPendingSubscriptions()` (below)
 * calling it a second time — any page calling both reran the whole
 * detector + 2 unbounded selects + a conditional insert twice. Now merges
 * the already-fetched `existing` rows with the newly-inserted rows
 * (returned directly from the insert via `.select()`) in memory instead of
 * re-querying, and is `cache()`-wrapped (no params, safe per-request
 * memoization — same pattern as `getProfile()`).
 */
export const getDetectedSubscriptions = cache(async (): Promise<DetectedSubscription[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { from, to } = lookbackRange();
  const [transactions, { data: existing, error: existingError }] = await Promise.all([
    getTransactions({ from, to, type: "expense" }),
    supabase.from("detected_subscriptions").select("*"),
  ]);
  if (existingError) throwDbError(existingError, "subscriptions.getDetectedSubscriptions", "Failed to load detected subscriptions");

  const existingRows = existing ?? [];
  const existingMerchants = new Set(existingRows.map((s) => s.merchant.trim().toLowerCase()));

  const candidates = detectSubscriptions(
    transactions
      .filter((t) => t.merchant)
      .map((t) => ({ merchant: t.merchant as string, amountCents: parseMoneyToCents(t.amount), date: new Date(t.transaction_date) }))
  );

  const newCandidates = candidates.filter((c) => !existingMerchants.has(c.merchant.trim().toLowerCase()));

  let insertedRows: DetectedSubscription[] = [];
  if (newCandidates.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("detected_subscriptions")
      .insert(
        newCandidates.map((c) => ({
          user_id: user.id,
          merchant: c.merchant,
          estimated_amount: centsToDecimalString(c.estimatedAmountCents),
          frequency: c.frequency,
          confidence: c.confidence,
          occurrence_count: c.occurrenceCount,
          first_seen_date: toLocalDateString(c.firstSeenDate),
          last_seen_date: toLocalDateString(c.lastSeenDate),
          next_expected_date: toLocalDateString(c.nextExpectedDate),
          status: "pending",
        }))
      )
      .select();
    if (insertError) throwDbError(insertError, "subscriptions.getDetectedSubscriptions", "Failed to save detected subscriptions");
    insertedRows = inserted ?? [];
  }

  // Numeric sort, not string — `estimated_amount` is a decimal STRING here
  // (PostgREST serializes `numeric` columns as text), and a plain string
  // comparison would sort "10.00" before "9.00".
  return [...existingRows, ...insertedRows].sort(
    (a, b) => parseMoneyToCents(b.estimated_amount) - parseMoneyToCents(a.estimated_amount)
  );
});

export async function getPendingSubscriptions(): Promise<DetectedSubscription[]> {
  const all = await getDetectedSubscriptions();
  return all.filter((s) => s.status === "pending");
}
