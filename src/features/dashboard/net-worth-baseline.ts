import { calendarMonth } from "@/lib/date";

/**
 * Snapshot dates are stored calendar dates, not timestamps: do not shift them.
 * Use the latest date in the immediately preceding calendar month. Missing
 * that month means no comparison history; never substitute a daily/older row.
 */
export function previousMonthSnapshot<T extends { snapshot_date: string }>(
  snapshots: readonly T[],
  today: string,
): T | null {
  const { from, to } = calendarMonth(today, -1);
  return snapshots.reduce<T | null>((latest, snapshot) =>
    snapshot.snapshot_date >= from && snapshot.snapshot_date <= to &&
    (!latest || snapshot.snapshot_date > latest.snapshot_date) ? snapshot : latest,
  null);
}

/** How close a pre-year snapshot must be to 1 Jan before Home calls the change "this year". */
export const YEAR_BASELINE_WINDOW_DAYS = 92;

export type YearDeltaScope = "year" | "since";

export function shiftCalendarDate(isoDate: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error("Invalid date");
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Windows for the Home net-worth line. `nearFrom`..`nearTo` is the latest
 * snapshot on or before 1 Jan that is still close enough to call "this year".
 * `inYearFrom` is the first day after 1 Jan, for an honest "since {month}"
 * fallback when the year did not start with a snapshot.
 */
export function yearChangeLookupWindow(today: string): { nearFrom: string; nearTo: string; inYearFrom: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("Invalid date");
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return {
    nearFrom: shiftCalendarDate(yearStart, -YEAR_BASELINE_WINDOW_DAYS),
    nearTo: yearStart,
    inYearFrom: shiftCalendarDate(yearStart, 1),
  };
}

/**
 * `year` when the baseline is on or before 1 Jan and within
 * YEAR_BASELINE_WINDOW_DAYS of it. `since` when it is an earlier point we
 * can still subtract, but must not label as the whole year. Null when the
 * snapshot is not strictly before today.
 */
export function classifyYearDeltaBaseline(snapshotDate: string, today: string): YearDeltaScope | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error("Invalid date");
  }
  if (snapshotDate >= today) return null;
  const yearStart = `${today.slice(0, 4)}-01-01`;
  if (snapshotDate <= yearStart) {
    const start = Date.parse(`${yearStart}T00:00:00Z`);
    const snap = Date.parse(`${snapshotDate}T00:00:00Z`);
    return start - snap <= YEAR_BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000 ? "year" : "since";
  }
  return snapshotDate.slice(0, 4) === today.slice(0, 4) ? "since" : null;
}
