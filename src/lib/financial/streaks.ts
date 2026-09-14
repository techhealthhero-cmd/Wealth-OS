/**
 * Streaks — deterministic, forgiving by design (CLAUDE.md Day 6: "avoid
 * punishing resets, guilt language, aggressive streak-loss warnings").
 * Every streak here is computed live from dates already recorded elsewhere
 * (transactions, completed monthly reviews) — no dedicated streak table,
 * so there's nothing to fall out of sync.
 *
 * "Forgiving" concretely means: the current, still-in-progress period (this
 * week / this month / today) is never held against the streak just because
 * it hasn't happened yet — only a fully-elapsed period with no activity
 * breaks it.
 */

function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoWeekKey(date: Date): string {
  const d = toDateOnly(date);
  // Shift to the Thursday of this ISO week, then read its ISO year/week.
  const dayNum = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dayNum + 3);
  const isoYearStart = new Date(d.getFullYear(), 0, 4);
  const isoWeek = 1 + Math.round(((d.getTime() - isoYearStart.getTime()) / 86400000 - 3 + ((isoYearStart.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(isoWeek).padStart(2, "0")}`;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function dayKey(date: Date): string {
  return toDateOnly(date).toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Weeks with at least one qualifying activity date, counted back from the current week. */
export function calculateWeeklyStreak(activityDates: Date[], today: Date = new Date()): number {
  const weeks = new Set(activityDates.map(isoWeekKey));
  let cursor = today;
  if (!weeks.has(isoWeekKey(cursor))) cursor = addWeeks(cursor, -1);

  let streak = 0;
  while (weeks.has(isoWeekKey(cursor))) {
    streak++;
    cursor = addWeeks(cursor, -1);
  }
  return streak;
}

/** Consecutive calendar months with a completed monthly review, counted back from the current month. */
export function calculateMonthlyReviewStreak(reviewDates: Date[], today: Date = new Date()): number {
  const months = new Set(reviewDates.map(monthKey));
  let cursor = today;
  if (!months.has(monthKey(cursor))) cursor = addMonths(cursor, -1);

  let streak = 0;
  while (months.has(monthKey(cursor))) {
    streak++;
    cursor = addMonths(cursor, -1);
  }
  return streak;
}

/** Consecutive calendar days with at least one recorded transaction, counted back from today. */
export function calculateTrackingDaysStreak(transactionDates: Date[], today: Date = new Date()): number {
  const days = new Set(transactionDates.map(dayKey));
  let cursor = today;
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
