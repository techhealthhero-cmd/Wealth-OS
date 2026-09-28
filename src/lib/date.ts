/**
 * `date.toISOString().slice(0, 10)` is a common but incorrect way to get a
 * "YYYY-MM-DD" calendar-date string: `toISOString()` converts to UTC first,
 * so for any timezone ahead of UTC (including Asia/Bangkok, UTC+7 — this
 * app's primary market) it silently rolls back to the previous day for
 * roughly the first several hours of local time. A budget's `month` column
 * requires the 1st of the month exactly (`CHECK (month = date_trunc('month',
 * month)::date)`) — that CHECK, or the app's own regex validation, catches
 * the corrupted value and rejects it outright; a plain `transaction_date`
 * has no such guard and would silently record the wrong day instead.
 *
 * Always use this for a *local calendar date* string. `toISOString()`
 * remains correct and unchanged for actual UTC timestamps (e.g.
 * `created_at`/`updated_at`/`last_updated_at` columns).
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * "Today" as YYYY-MM-DD in a specific IANA time zone — for SERVER code,
 * where the process runs in UTC (Vercel) and `toLocalDateString(new Date())`
 * would give the UTC calendar day, not the user's (Thailand is UTC+7).
 */
export function todayInTimeZone(timeZone = "Asia/Bangkok", now: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  }
}

/**
 * Adds `months` to `date`, clamping to the last real day of the resulting
 * month when the original day doesn't exist there (e.g. Jan 31 + 1 month ->
 * Feb 28/29, never a silent overflow into March). Mirrors the same
 * month-end-clamping rule `calculateNextDueDate()` (src/lib/financial/
 * recurring.ts) already uses for recurring transactions — kept as a
 * separate small utility here since it's genuinely generic (goal/target
 * date math), not recurring-transaction-specific.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== day) result.setDate(0);
  return result;
}
