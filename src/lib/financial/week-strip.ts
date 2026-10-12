import { calculateExpenses, calculateIncome, type FinancialTransaction } from "./calculations";

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
  /** Income less spending that day (2026-10-12: the strip shows this, signed). */
  netCents: number;
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
    const dayTransactions = transactions.filter((t) => t.transaction_date === date);
    const spentCents = calculateExpenses(dayTransactions);
    return {
      date,
      index,
      spentCents,
      netCents: calculateIncome(dayTransactions) - spentCents,
      hasPending: pending.has(date),
      isToday: date === today,
      isFuture: date > today,
    };
  });
}

/** How many weeks the scroll calendar can unroll (2026-10-12). */
export const SCROLL_WEEKS = 4;

export interface ScrollWeek {
  days: WeekStripDay[];
  /** Income less spending across the 7 days. */
  netCents: number;
}

/**
 * The scroll calendar's weeks, NEWEST FIRST: weeks[0] is the 7 days from
 * `weekStart`, weeks[1] the 7 before it, and so on — unrolling the scroll
 * goes back in time. `transactions` should cover all `count` weeks.
 */
export function buildScrollWeeks(
  weekStart: string,
  today: string,
  transactions: (FinancialTransaction & { transaction_date: string })[],
  pendingDates: Iterable<string>,
  count: number = SCROLL_WEEKS
): ScrollWeek[] {
  const pending = [...pendingDates];
  return Array.from({ length: count }, (_, w) => {
    const days = buildWeekStrip(addDaysIso(weekStart, -7 * w), today, transactions, pending);
    return { days, netCents: days.reduce((sum, d) => sum + d.netCents, 0) };
  });
}
