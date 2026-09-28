import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { todayInTimeZone } from "@/lib/date";
import type { Transaction } from "@/types/database";

export const QUICK_CAPTURE_SOURCES = ["quick_text", "voice", "receipt"] as const;

export interface InboxTransaction
  extends Pick<
    Transaction,
    "id" | "type" | "amount" | "transaction_date" | "description" | "merchant" | "category_id" | "account_id" | "source"
  > {
  review_status: "confirmed" | "needs_review";
  ai_confidence: "high" | "medium" | "low" | null;
  account_name: string | null;
}

export interface DailyInbox {
  today: string;
  /** Today's quick captures (confirmed + pending) and any older item still pending review. */
  items: InboxTransaction[];
  todayCount: number;
  confirmedTodayCount: number;
  pendingCount: number;
}

/**
 * Daily Inbox data, or null when it can't apply — e.g. migration 0021 isn't
 * on this database yet (unknown `review_status` column) — so the dashboard
 * simply doesn't render the card instead of erroring.
 */
export async function getDailyInbox(): Promise<DailyInbox | null> {
  const profile = await getProfile();
  const today = todayInTimeZone(profile?.timezone ?? "Asia/Bangkok");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, type, amount, transaction_date, description, merchant, category_id, account_id, source, review_status, ai_confidence, account:accounts!transactions_account_id_fkey(name)"
    )
    .in("type", ["expense", "income"])
    .or(`review_status.eq.needs_review,and(transaction_date.eq.${today},source.in.(${QUICK_CAPTURE_SOURCES.join(",")}))`)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !data) return null;

  const items: InboxTransaction[] = data.map((row) => {
    const { account, ...rest } = row as typeof row & { account: { name: string } | { name: string }[] | null };
    const accountRow = Array.isArray(account) ? account[0] : account;
    return {
      ...(rest as Omit<InboxTransaction, "account_name">),
      account_name: accountRow?.name ?? null,
    };
  });

  const todays = items.filter((t) => t.transaction_date === today);
  return {
    today,
    items,
    todayCount: todays.length,
    confirmedTodayCount: todays.filter((t) => t.review_status === "confirmed").length,
    pendingCount: items.filter((t) => t.review_status === "needs_review").length,
  };
}
