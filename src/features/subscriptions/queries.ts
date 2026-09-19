import "server-only";

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
 */
export async function getDetectedSubscriptions(): Promise<DetectedSubscription[]> {
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

  const existingMerchants = new Set((existing ?? []).map((s) => s.merchant.trim().toLowerCase()));

  const candidates = detectSubscriptions(
    transactions
      .filter((t) => t.merchant)
      .map((t) => ({ merchant: t.merchant as string, amountCents: parseMoneyToCents(t.amount), date: new Date(t.transaction_date) }))
  );

  const newCandidates = candidates.filter((c) => !existingMerchants.has(c.merchant.trim().toLowerCase()));

  if (newCandidates.length > 0) {
    const { error: insertError } = await supabase.from("detected_subscriptions").insert(
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
    );
    if (insertError) throwDbError(insertError, "subscriptions.getDetectedSubscriptions", "Failed to save detected subscriptions");
  }

  const { data: finalList, error: finalError } = await supabase
    .from("detected_subscriptions")
    .select("*")
    .order("estimated_amount", { ascending: false });
  if (finalError) throwDbError(finalError, "subscriptions.getDetectedSubscriptions", "Failed to load detected subscriptions");
  return finalList ?? [];
}

export async function getPendingSubscriptions(): Promise<DetectedSubscription[]> {
  const all = await getDetectedSubscriptions();
  return all.filter((s) => s.status === "pending");
}
