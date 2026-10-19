import "server-only";
import { cache } from "react";
import { throwDbError } from "@/lib/db-error";

import { createClient } from "@/lib/supabase/server";
import { getLiabilities } from "@/features/liabilities/queries";
import { isDue, hasEnded } from "@/lib/financial/recurring";
import { categorizeUpcomingBills, recurringBillItems, type BillItem } from "@/lib/financial/upcoming-bills";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import { deterministicUuid } from "@/lib/uuid";
import { shiftMonth, type PaymentSource } from "@/lib/financial/payment-calendar";
import type { RecurringTransaction } from "@/types/database";

/** Wrapped in React's `cache()` (perf audit finding) — `/money/recurring` calls this both directly and via `getUpcomingBills()`. */
export const getRecurringTransactions = cache(async (): Promise<RecurringTransaction[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .order("next_due_date", { ascending: true });
  if (error) throwDbError(error, "recurring.getRecurringTransactions", "Failed to load recurring transactions");
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
  const items: BillItem[] = recurringBillItems(recurring, toLocalDateString(new Date()));

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

/** How far back the calendar looks for confirmed (paid) occurrences — also the earliest month it navigates to. */
export const PAID_LOOKBACK_MONTHS = 12;
const PAGE_SIZE = 1000;

/**
 * Obligations for the payment calendar: non-income recurring schedules
 * (active ones project future dates; ended/archived ones keep their paid
 * history) plus liability due dates — the same inputs as `getUpcomingBills`.
 * Duplicate obligations are collapsed per occurrence later
 * (`dedupeOccurrences`), never by dropping a whole source.
 *
 * Paid signal — matched from real transactions, independent of the editable
 * schedule template: `confirmRecurringTransaction` records the occurrence
 * with `transaction_date = next_due_date` and `client_request_id =
 * deterministicUuid("recurring-confirm:{id}:{dueDate}")` — for expenses via
 * a direct insert (source "recurring"), for transfers via `create_transfer`
 * (which stores the same key and date, but source "manual"). So every keyed
 * transaction in the window is checked against each schedule id at its own
 * date; a match is a paid occurrence at that transaction's date and amount.
 * RLS scopes the read to the user. Liabilities have no such link, so they
 * are never marked paid.
 */
export async function getPaymentCalendarSources(today: string): Promise<PaymentSource[]> {
  const supabase = await createClient();
  const lookbackFrom = `${shiftMonth(today.slice(0, 7), -PAID_LOOKBACK_MONTHS)}-01`;

  async function loadKeyedTransactions() {
    const rows: { id: string; amount: string; transaction_date: string; client_request_id: string | null }[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, transaction_date, client_request_id")
        .not("client_request_id", "is", null)
        .or("source.eq.recurring,type.eq.transfer")
        .gte("transaction_date", lookbackFrom)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throwDbError(error, "recurring.getPaymentCalendarSources", "Failed to load confirmed recurring payments");
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) return rows;
    }
  }

  const [recurring, liabilities, keyed] = await Promise.all([getRecurringTransactions(), getLiabilities(), loadKeyedTransactions()]);
  const todayDate = new Date(`${today}T00:00:00`);
  const sources: PaymentSource[] = [];

  for (const r of recurring) {
    if (r.type === "income") continue;
    sources.push({
      id: r.id,
      label: r.merchant || r.description || r.type,
      kind: r.type === "transfer" ? "transfer" : "expense",
      amountCents: parseMoneyToCents(r.amount),
      frequency: r.frequency,
      nextDueDate: r.next_due_date,
      endDate: r.end_date,
      active: r.is_active && !hasEnded(r.end_date ? new Date(`${r.end_date}T00:00:00`) : null, todayDate),
      paid: [],
    });
  }

  if (sources.length > 0 && keyed.length > 0) {
    const keyToSource = new Map<string, PaymentSource>();
    for (const date of new Set(keyed.map((t) => t.transaction_date))) {
      for (const s of sources) keyToSource.set(deterministicUuid(`recurring-confirm:${s.id}:${date}`), s);
    }
    for (const t of keyed) {
      const match = t.client_request_id ? keyToSource.get(t.client_request_id) : undefined;
      if (match) match.paid.push({ date: t.transaction_date, amountCents: parseMoneyToCents(t.amount) });
    }
  }

  for (const l of liabilities) {
    if (!l.due_date || !l.minimum_payment) continue;
    sources.push({
      id: l.id,
      label: l.name,
      kind: "liability",
      amountCents: parseMoneyToCents(l.minimum_payment),
      frequency: null,
      nextDueDate: l.due_date,
      endDate: null,
      active: true,
      paid: [],
    });
  }

  return sources;
}
