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
