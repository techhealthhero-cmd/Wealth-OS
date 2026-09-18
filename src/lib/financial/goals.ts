/**
 * Financial Goals — deterministic progress/contribution/schedule math.
 * Dates are compared at day granularity (UTC midnight) so "today" is stable
 * within a single calculation.
 */

import { addMonthsClamped } from "./recurring";

export type GoalScheduleStatus = "achieved" | "ahead" | "on_track" | "behind" | "unknown";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AVG_DAYS_PER_MONTH = 30.44;

function monthsBetween(from: Date, to: Date): number {
  const days = (to.getTime() - from.getTime()) / MS_PER_DAY;
  return days / AVG_DAYS_PER_MONTH;
}

/** 0-100, capped — a goal can't be more than "fully" progressed for display purposes. */
export function calculateGoalProgress(currentCents: number, targetCents: number): number {
  if (targetCents <= 0) return 0;
  return Math.min(100, Math.max(0, (currentCents / targetCents) * 100));
}

export function calculateAmountRemaining(currentCents: number, targetCents: number): number {
  return Math.max(0, targetCents - currentCents);
}

/**
 * Required monthly contribution to reach the target by targetDate.
 * Returns null when there's nothing left to save, or when the target date
 * has already passed (no valid number of future months to spread it over —
 * the caller should surface this as "needed now" rather than a monthly rate).
 */
export function calculateRequiredMonthlyContribution(
  currentCents: number,
  targetCents: number,
  targetDate: Date | null,
  today: Date = new Date()
): number | null {
  const remainingCents = calculateAmountRemaining(currentCents, targetCents);
  if (remainingCents === 0) return 0;
  if (!targetDate) return null;

  const monthsLeft = monthsBetween(today, targetDate);
  if (monthsLeft <= 0) return null;

  return Math.ceil(remainingCents / monthsLeft);
}

/**
 * Projected completion date given a flat monthly contribution. Returns null
 * when the goal can never complete at this rate (contribution <= 0 and not
 * already achieved).
 */
export function calculateProjectedCompletionDate(
  currentCents: number,
  targetCents: number,
  monthlyContributionCents: number,
  today: Date = new Date()
): Date | null {
  const remainingCents = calculateAmountRemaining(currentCents, targetCents);
  if (remainingCents === 0) return today;
  if (monthlyContributionCents <= 0) return null;

  const monthsNeeded = Math.ceil(remainingCents / monthlyContributionCents);
  return addMonthsClamped(today, monthsNeeded);
}

/**
 * Ahead/behind/on-track schedule state, derived by comparing the projected
 * completion date (at the current contribution rate) against the target
 * date. 'unknown' when there isn't enough information to project (no target
 * date, or no contribution and not yet achieved) — this is presented as a
 * neutral "can't tell yet" state, not a penalty.
 */
export function calculateGoalScheduleStatus(
  currentCents: number,
  targetCents: number,
  targetDate: Date | null,
  monthlyContributionCents: number,
  today: Date = new Date()
): GoalScheduleStatus {
  if (currentCents >= targetCents) return "achieved";
  if (!targetDate) return "unknown";

  const projected = calculateProjectedCompletionDate(currentCents, targetCents, monthlyContributionCents, today);
  if (!projected) return "unknown";

  const bufferDays = 3; // avoid flip-flopping to "behind" over same-day rounding
  const diffDays = (targetDate.getTime() - projected.getTime()) / MS_PER_DAY;

  if (diffDays >= bufferDays) return "ahead";
  if (diffDays <= -bufferDays) return "behind";
  return "on_track";
}
