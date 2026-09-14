/**
 * Recurring Transactions — deterministic due-date math only. Posting policy
 * (documented at the migration/action layer): **confirmation-first** — a
 * due item is only ever surfaced to the user; a real `transactions` row is
 * created solely by an explicit user confirmation, never automatically.
 */

import type { RecurringFrequency } from "@/types/database";

/** Adds one interval of `frequency` to `date`, handling month-length edge cases (e.g. Jan 31 + monthly -> Feb 28). */
export function calculateNextDueDate(date: Date, frequency: RecurringFrequency): Date {
  switch (frequency) {
    case "weekly":
      return addDays(date, 7);
    case "biweekly":
      return addDays(date, 14);
    case "monthly":
      return addMonthsClamped(date, 1);
    case "quarterly":
      return addMonthsClamped(date, 3);
    case "yearly":
      return addMonthsClamped(date, 12);
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetMonthIndex = date.getMonth() + months;
  const daysInTargetMonth = new Date(date.getFullYear(), targetMonthIndex + 1, 0).getDate();
  const day = Math.min(date.getDate(), daysInTargetMonth);
  return new Date(date.getFullYear(), targetMonthIndex, day);
}

export function isDue(nextDueDate: Date, asOf: Date = new Date()): boolean {
  return stripTime(nextDueDate) <= stripTime(asOf);
}

export function isOverdue(nextDueDate: Date, asOf: Date = new Date()): boolean {
  return stripTime(nextDueDate) < stripTime(asOf);
}

export function hasEnded(endDate: Date | null, asOf: Date = new Date()): boolean {
  if (!endDate) return false;
  return stripTime(endDate) < stripTime(asOf);
}

function stripTime(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
