import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getLiabilities } from "@/features/liabilities/queries";
import { isDue, hasEnded } from "@/lib/financial/recurring";
import { categorizeUpcomingBills, type BillItem } from "@/lib/financial/upcoming-bills";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import type { RecurringTransaction } from "@/types/database";

/** Wrapped in React's `cache()` (perf audit finding) — `/money/recurring` calls this both directly and via `getUpcomingBills()`. */
export const getRecurringTransactions = cache(async (): Promise<RecurringTransaction[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .order("next_due_date", { ascending: true });
  if (error) throw new Error("Failed to load recurring transactions");
  return data ?? [];
});

export async function getActiveRecurringTransactions(): Promise<RecurringTransaction[]> {
  const all = await getRecurringTransactions();
  return all.filter((r) => r.is_active && !hasEnded(r.end_date ? new Date(r.end_date) : null));
}

export type UpcomingBillItem = BillItem;
export type { CategorizedBills as UpcomingBillsSummary } from "@/lib/financial/upcoming-bills";

/**
 * Combines recurring-transaction due dates with liability due dates into one
 * view, then buckets them via the pure, unit-tested `categorizeUpcomingBills`
 * (date windows + duplicate-obligation collapsing).
 */
export async function getUpcomingBills() {
  const [recurring, liabilities] = await Promise.all([getActiveRecurringTransactions(), getLiabilities()]);
  const items: BillItem[] = [];

  for (const r of recurring) {
    if (r.type === "income") continue; // "bills" means obligations, not incoming money
    items.push({
      id: r.id,
      source: "recurring",
      label: r.merchant || r.description || r.type,
      amountCents: parseMoneyToCents(r.amount),
      dueDate: r.next_due_date,
      type: r.type,
    });
  }

  for (const l of liabilities) {
    if (!l.due_date || !l.minimum_payment) continue;
    items.push({
      id: l.id,
      source: "liability",
      label: l.name,
      amountCents: parseMoneyToCents(l.minimum_payment),
      dueDate: l.due_date,
      type: l.liability_type,
    });
  }

  return categorizeUpcomingBills(items);
}

/** Recurring items that are due (or overdue) right now and still awaiting user confirmation. */
export async function getDueRecurringTransactions(): Promise<RecurringTransaction[]> {
  const active = await getActiveRecurringTransactions();
  const now = new Date();
  return active.filter((r) => isDue(new Date(r.next_due_date), now));
}

export function getTodayIsoDate(): string {
  return toLocalDateString(new Date());
}
