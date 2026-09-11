/**
 * Money Year — annual/quarterly/monthly planning math. Deterministic only;
 * "actual" figures always come from real transaction/account/goal data
 * (see src/features/money-year/queries.ts), never invented here.
 */

export type PlanScheduleStatus = "ahead" | "on_track" | "behind";

export interface PlanProgress {
  targetCents: number;
  actualCents: number;
  remainingCents: number;
  /** 0-100+, uncapped — can exceed 100 once a target is surpassed. 0 when targetCents <= 0. */
  percent: number;
}

export function calculatePlanProgress(actualCents: number, targetCents: number): PlanProgress {
  if (targetCents <= 0) {
    return { targetCents, actualCents, remainingCents: 0, percent: 0 };
  }
  return {
    targetCents,
    actualCents,
    remainingCents: Math.max(0, targetCents - actualCents),
    percent: (actualCents / targetCents) * 100,
  };
}

const SCHEDULE_BUFFER_PERCENT = 5;

/**
 * Ahead/on-track/behind by comparing actual progress % against the
 * "expected by now" % implied by how much of the period has elapsed
 * (e.g. 50% through the year, expect ~50% of the annual target reached).
 * A small buffer avoids flip-flopping between states from day-to-day noise.
 */
export function calculatePlanScheduleStatus(
  actualCents: number,
  targetCents: number,
  elapsedFraction: number
): PlanScheduleStatus {
  // No target set — there's nothing to be ahead of or behind on.
  if (targetCents <= 0) return "on_track";

  const progress = calculatePlanProgress(actualCents, targetCents);
  const expectedPercent = Math.min(100, Math.max(0, elapsedFraction * 100));

  if (progress.percent >= expectedPercent + SCHEDULE_BUFFER_PERCENT) return "ahead";
  if (progress.percent <= expectedPercent - SCHEDULE_BUFFER_PERCENT) return "behind";
  return "on_track";
}

/** Fraction of a year elapsed by a given date (0 at Jan 1, ~1 at Dec 31). */
export function calculateYearElapsedFraction(year: number, today: Date = new Date()): number {
  if (today.getFullYear() < year) return 0;
  if (today.getFullYear() > year) return 1;
  const startOfYear = new Date(year, 0, 1);
  const startOfNextYear = new Date(year + 1, 0, 1);
  const totalMs = startOfNextYear.getTime() - startOfYear.getTime();
  const elapsedMs = today.getTime() - startOfYear.getTime();
  return Math.min(1, Math.max(0, elapsedMs / totalMs));
}

/** Fraction of a quarter elapsed (1-indexed quarter 1-4) by a given date. */
export function calculateQuarterElapsedFraction(
  year: number,
  quarter: number,
  today: Date = new Date()
): number {
  const startMonth = (quarter - 1) * 3;
  const startOfQuarter = new Date(year, startMonth, 1);
  const startOfNextQuarter = new Date(year, startMonth + 3, 1);
  if (today < startOfQuarter) return 0;
  if (today >= startOfNextQuarter) return 1;
  const totalMs = startOfNextQuarter.getTime() - startOfQuarter.getTime();
  const elapsedMs = today.getTime() - startOfQuarter.getTime();
  return elapsedMs / totalMs;
}

/**
 * Splits a total into `parts` integer-cent buckets that sum EXACTLY back to
 * the total (the remainder from integer division is distributed one cent at
 * a time to the first buckets) — used only as a starting suggestion when a
 * user creates quarters/months; never forced (a user's own custom amounts
 * are stored as-is and never overwritten by this).
 */
export function distributeEvenly(totalCents: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Which calendar quarter (1-4) a given month (0-indexed, JS Date convention) falls in. */
export function monthToQuarter(monthIndex0: number): number {
  return Math.floor(monthIndex0 / 3) + 1;
}
