/**
 * Payment calendar — pure date projection for recurring obligations.
 *
 * No new money formulas: amounts are the existing per-item amounts, and the
 * only arithmetic is summing them for display. Due dates are projected with
 * the same `calculateNextDueDate()` the confirm action uses to advance
 * `next_due_date`, so the calendar shows exactly the dates the app will ask
 * the user to confirm.
 *
 * All dates are "YYYY-MM-DD" calendar-date strings; months are "YYYY-MM".
 */

import type { RecurringFrequency } from "@/types/database";
import { calculateNextDueDate } from "./recurring";
import { deduplicateBillItems } from "./upcoming-bills";
import { toLocalDateString } from "@/lib/date";

export type PaymentKind = "expense" | "transfer" | "liability";

export const PAYMENT_KINDS: readonly PaymentKind[] = ["expense", "transfer", "liability"];

/** A confirmation verified against a real transaction. */
export interface PaidOccurrence {
  /** The recorded transaction's own date (the occurrence it confirmed). */
  date: string;
  /** The recorded transaction's own amount — not the template's current amount. */
  amountCents: number;
}

/** One obligation the calendar knows about (a recurring item or a liability's due date). */
export interface PaymentSource {
  id: string;
  label: string;
  kind: PaymentKind;
  /** Current template amount — used for unpaid occurrences only. */
  amountCents: number;
  /** null = a single due date with no repeat (a liability's `due_date`). */
  frequency: RecurringFrequency | null;
  /** Earliest occurrence the schedule still asks the user to confirm. */
  nextDueDate: string;
  endDate: string | null;
  /** Only active schedules project future (unpaid) occurrences; ended/archived ones keep their paid history. */
  active: boolean;
  /**
   * Occurrences verified as recorded — matched from real transactions, never
   * derived by replaying the (editable) schedule template.
   */
  paid: PaidOccurrence[];
}

export interface PaymentOccurrence {
  /** Unique per occurrence: `${sourceId}:${date}`. */
  key: string;
  sourceId: string;
  label: string;
  kind: PaymentKind;
  amountCents: number;
  date: string;
  paid: boolean;
}

export interface MonthPaymentSummary {
  totalCents: number;
  paidCents: number;
  leftCents: number;
  paidCount: number;
  leftCount: number;
  /** Totals per kind, only kinds that occur, in PAYMENT_KINDS order. */
  byKind: { kind: PaymentKind; cents: number }[];
}

/** Iteration guard: weekly items over many years still stay far below this. */
const MAX_STEPS = 2000;

/**
 * Date-only strings are read as LOCAL midnight before stepping with
 * calculateNextDueDate (which uses local getters). confirmRecurringTransaction
 * does `new Date(next_due_date)` (UTC midnight); on UTC and UTC+ runtimes
 * (Vercel, Asia/Bangkok) both read the same calendar day, so the chain here
 * steps the same way as the confirm action.
 */
function parseLocal(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** "2026-10" + 1 → "2026-11"; handles year roll-over both ways. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  const year = Math.floor(index / 12);
  const mm = (index % 12) + 1;
  return `${year}-${String(mm).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * Due dates of one item that fall inside [from, to] (inclusive), starting at
 * `nextDueDate` and stepping by `frequency` — stops after `endDate`. A
 * one-off (frequency null) yields at most its own date.
 */
export function projectDueDates(
  nextDueDate: string,
  frequency: RecurringFrequency | null,
  endDate: string | null,
  from: string,
  to: string
): string[] {
  const dates: string[] = [];
  let current = nextDueDate;
  for (let step = 0; step < MAX_STEPS; step++) {
    if (current > to) break;
    if (endDate && current > endDate) break;
    if (current >= from) dates.push(current);
    if (!frequency) break;
    current = toLocalDateString(calculateNextDueDate(parseLocal(current), frequency));
  }
  return dates;
}

/**
 * Occurrences of one source in [from, to]: verified-paid confirmations on
 * their recorded date and amount, plus (active schedules only) the unpaid
 * projection from `nextDueDate`, skipping a date already verified paid
 * (e.g. the insert succeeded but advancing `next_due_date` failed).
 *
 * Deliberate scope decision: unpaid/overdue occurrences come only from
 * `nextDueDate` forward. A confirmation whose transaction was later deleted
 * is NOT resurfaced as overdue — detecting that would mean replaying the
 * editable template (start_date/frequency), which can fabricate obligations
 * that never existed. Honest omission over invention.
 */
function sourceOccurrences(source: PaymentSource, from: string, to: string): PaymentOccurrence[] {
  const out: PaymentOccurrence[] = [];
  const seen = new Set<string>();
  const push = (date: string, paid: boolean, amountCents: number) => {
    // One confirmation per (schedule, date) — the idempotency key is unique.
    if (seen.has(date)) return;
    seen.add(date);
    out.push({ key: `${source.id}:${date}`, sourceId: source.id, label: source.label, kind: source.kind, amountCents, date, paid });
  };
  for (const p of source.paid) {
    if (p.date >= from && p.date <= to) push(p.date, true, p.amountCents);
  }
  if (!source.active) return out;
  for (const date of projectDueDates(source.nextDueDate, source.frequency, source.endDate, from, to)) {
    push(date, false, source.amountCents);
  }
  return out;
}

/**
 * The upcoming list's duplicate-obligation rule (`deduplicateBillItems`:
 * same label + date + amount), applied per occurrence. Paid occurrences are
 * never dropped; among unpaid duplicates a recurring item wins over a
 * liability, and an unpaid duplicate of a paid occurrence is dropped.
 */
export function dedupeOccurrences(occurrences: PaymentOccurrence[]): PaymentOccurrence[] {
  const rank = (o: PaymentOccurrence) => (o.paid ? 0 : o.kind === "liability" ? 2 : 1);
  const ordered = [...occurrences].sort((a, b) => rank(a) - rank(b));
  const paid = ordered.filter((o) => o.paid);
  const paidKeys = new Set(paid.map((o) => `${o.label.trim().toLowerCase()}|${o.date}|${o.amountCents}`));
  const unpaid = ordered.filter((o) => !o.paid && !paidKeys.has(`${o.label.trim().toLowerCase()}|${o.date}|${o.amountCents}`));
  const keptUnpaid = new Set(
    deduplicateBillItems(
      unpaid.map((o) => ({
        id: o.key,
        source: o.kind === "liability" ? ("liability" as const) : ("recurring" as const),
        label: o.label,
        amountCents: o.amountCents,
        dueDate: o.date,
        type: o.kind,
      }))
    ).map((b) => b.id)
  );
  return occurrences.filter((o) => o.paid || keptUnpaid.has(o.key));
}

const byDateThenLabel = (a: PaymentOccurrence, b: PaymentOccurrence) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label);

/** Every occurrence in `month` (deduplicated), sorted by date, then label. */
export function buildMonthPayments(sources: PaymentSource[], month: string): PaymentOccurrence[] {
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  return dedupeOccurrences(sources.flatMap((source) => sourceOccurrences(source, from, to))).sort(byDateThenLabel);
}

/** Sums for display only — the amounts themselves are the items' own. */
export function summarizeMonthPayments(occurrences: PaymentOccurrence[]): MonthPaymentSummary {
  let totalCents = 0;
  let paidCents = 0;
  let paidCount = 0;
  const kindTotals = new Map<PaymentKind, number>();
  for (const o of occurrences) {
    totalCents += o.amountCents;
    if (o.paid) {
      paidCents += o.amountCents;
      paidCount += 1;
    }
    kindTotals.set(o.kind, (kindTotals.get(o.kind) ?? 0) + o.amountCents);
  }
  return {
    totalCents,
    paidCents,
    leftCents: totalCents - paidCents,
    paidCount,
    leftCount: occurrences.length - paidCount,
    byKind: PAYMENT_KINDS.filter((k) => kindTotals.has(k)).map((kind) => ({ kind, cents: kindTotals.get(kind)! })),
  };
}

/** Earliest unpaid occurrence of an active source (skipping verified-paid dates), or null. */
export function firstUnpaidDate(source: PaymentSource): string | null {
  if (!source.active) return null;
  const paid = new Set(source.paid.map((p) => p.date));
  let current = source.nextDueDate;
  for (let step = 0; step < MAX_STEPS; step++) {
    if (source.endDate && current > source.endDate) return null;
    if (!paid.has(current)) return current;
    if (!source.frequency) return null;
    current = toLocalDateString(calculateNextDueDate(parseLocal(current), source.frequency));
  }
  return null;
}

/** The next `limit` unpaid payments (deduplicated, one per source), in due-date order (overdue first). */
export function nextPayments(sources: PaymentSource[], limit: number): PaymentOccurrence[] {
  const candidates = sources.flatMap((s) => {
    const date = firstUnpaidDate(s);
    return date ? [{ key: `${s.id}:${date}`, sourceId: s.id, label: s.label, kind: s.kind, amountCents: s.amountCents, date, paid: false }] : [];
  });
  // Include verified-paid occurrences in deduplication so an unpaid duplicate
  // (e.g. a liability mirroring a paid recurring item) is dropped, then keep unpaid only.
  const paidOccurrences: PaymentOccurrence[] = sources.flatMap((s) =>
    s.paid.map((p) => ({ key: `${s.id}:${p.date}`, sourceId: s.id, label: s.label, kind: s.kind, amountCents: p.amountCents, date: p.date, paid: true })),
  );
  return dedupeOccurrences([...paidOccurrences, ...candidates])
    .filter((o) => !o.paid)
    .sort(byDateThenLabel)
    .slice(0, limit);
}

export interface CalendarCell {
  date: string;
  day: number;
  inMonth: boolean;
}

/** Full weeks (Sunday first) covering `month`, including leading/trailing days of adjacent months. */
export function monthGrid(month: string): CalendarCell[] {
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const total = daysInMonth(month);
  const cellCount = Math.ceil((firstWeekday + total) / 7) * 7;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < cellCount; i++) {
    const d = new Date(Date.UTC(y, m - 1, 1 - firstWeekday + i));
    cells.push({
      date: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: i >= firstWeekday && i < firstWeekday + total,
    });
  }
  return cells;
}
