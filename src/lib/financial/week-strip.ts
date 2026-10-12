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

const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** A YYYY-MM month string. */
export function isIsoMonth(value: string | null | undefined): value is string {
  return !!value && ISO_MONTH.test(value);
}

export function addMonthsIso(month: string, months: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 7);
}

/**
 * The wall calendar's grid for `month` (YYYY-MM): whole Monday-to-Sunday
 * weeks from the Monday on or before the 1st to the Sunday on or after the
 * last day — 4 to 6 rows.
 */
export function monthGridRange(month: string): { start: string; end: string } {
  const last = addDaysIso(`${addMonthsIso(month, 1)}-01`, -1);
  return { start: weekStartOf(`${month}-01`), end: addDaysIso(weekStartOf(last), 6) };
}

export interface MonthGridDay extends WeekStripDay {
  /** false for the leading/trailing days of the neighbouring months. */
  inMonth: boolean;
}

export interface MonthGrid {
  month: string;
  weeks: MonthGridDay[][];
  /** Income less spending over the month's own days up to today. */
  netCents: number;
  /** The biggest single day's spending in the grid (scales the heat marks). */
  maxSpentCents: number;
  /** The row the folded calendar shows: today's week, or the last row of a past month. */
  focusRow: number;
}

/**
 * The wall calendar on Money › Transactions (2026-10-12, mockup 2): a real
 * calendar month, Monday first. `transactions` should cover
 * `monthGridRange(month)`.
 */
export function buildMonthGrid(
  month: string,
  today: string,
  transactions: (FinancialTransaction & { transaction_date: string })[],
  pendingDates: Iterable<string>
): MonthGrid {
  const { start, end } = monthGridRange(month);
  const pending = [...pendingDates];
  const weeks: MonthGridDay[][] = [];
  for (let weekStart = start; weekStart <= end; weekStart = addDaysIso(weekStart, 7)) {
    weeks.push(
      buildWeekStrip(weekStart, today, transactions, pending).map((day) => ({
        ...day,
        inMonth: day.date.startsWith(month),
      }))
    );
  }
  const days = weeks.flat().filter((d) => !d.isFuture);
  const todayRow = weeks.findIndex((w) => w.some((d) => d.isToday));
  return {
    month,
    weeks,
    netCents: days.filter((d) => d.inMonth).reduce((sum, d) => sum + d.netCents, 0),
    maxSpentCents: days.reduce((max, d) => Math.max(max, d.spentCents), 0),
    focusRow: todayRow >= 0 ? todayRow : weeks.length - 1,
  };
}
