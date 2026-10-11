import { calculateExpenses, type FinancialTransaction } from "./calculations";

/**
 * The 7-day strip on Money › Transactions (2026-10-11): seven days from
 * `weekStart` (the page uses the last 7 ending today), each day's net
 * spending (expenses less refunds, the same rule as every other "spent"
 * figure in the app) and whether anything that day still needs review.
 * Pure and deterministic; dates are plain YYYY-MM-DD strings.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday on or before `date`. */
export function weekStartOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysIso(date, day === 0 ? -6 : 1 - day);
}

export interface WeekStripDay {
  date: string;
  /** 0 = Monday … 6 = Sunday. */
  index: number;
  spentCents: number;
  hasPending: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export function buildWeekStrip(
  weekStart: string,
  today: string,
  transactions: (FinancialTransaction & { transaction_date: string })[],
  pendingDates: Iterable<string>
): WeekStripDay[] {
  const pending = new Set(pendingDates);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDaysIso(weekStart, index);
    return {
      date,
      index,
      spentCents: calculateExpenses(transactions.filter((t) => t.transaction_date === date)),
      hasPending: pending.has(date),
      isToday: date === today,
      isFuture: date > today,
    };
  });
}
