import { describe, expect, it } from "vitest";

import { calculateWeeklyStreak, calculateMonthlyReviewStreak, calculateTrackingDaysStreak } from "@/lib/financial/streaks";

// A fixed Wednesday so week/month boundaries are unambiguous in every test.
const TODAY = new Date(2026, 8, 16); // 2026-09-16

function daysAgo(days: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - days);
  return d;
}

function monthsAgo(months: number): Date {
  return new Date(TODAY.getFullYear(), TODAY.getMonth() - months, 1);
}

describe("calculateTrackingDaysStreak — continuity", () => {
  it("counts consecutive days including today", () => {
    const dates = [daysAgo(0), daysAgo(1), daysAgo(2)];
    expect(calculateTrackingDaysStreak(dates, TODAY)).toBe(3);
  });

  it("stops counting at the first gap", () => {
    const dates = [daysAgo(0), daysAgo(1), daysAgo(3)]; // gap at day 2
    expect(calculateTrackingDaysStreak(dates, TODAY)).toBe(2);
  });

  it("is forgiving about today — no activity yet today does not reset the streak from yesterday", () => {
    const dates = [daysAgo(1), daysAgo(2), daysAgo(3)]; // nothing logged yet today
    expect(calculateTrackingDaysStreak(dates, TODAY)).toBe(3);
  });

  it("returns 0 when there is no recent activity at all", () => {
    expect(calculateTrackingDaysStreak([], TODAY)).toBe(0);
  });
});

describe("calculateWeeklyStreak — grace behavior", () => {
  it("counts the current week if it already has activity", () => {
    expect(calculateWeeklyStreak([TODAY], TODAY)).toBe(1);
  });

  it("does not punish a still-in-progress week with no activity yet — checks last week instead", () => {
    const lastWeekActivity = daysAgo(7);
    expect(calculateWeeklyStreak([lastWeekActivity], TODAY)).toBe(1);
  });

  it("breaks only once a fully-elapsed week has no activity", () => {
    const twoWeeksAgo = daysAgo(14);
    // Nothing this week, nothing last week -> the gap at "last week" ends the streak at 0
    expect(calculateWeeklyStreak([twoWeeksAgo], TODAY)).toBe(0);
  });
});

describe("calculateMonthlyReviewStreak — no punitive reset logic, just a count", () => {
  it("counts consecutive months with a completed review", () => {
    const reviews = [monthsAgo(0), monthsAgo(1), monthsAgo(2)];
    expect(calculateMonthlyReviewStreak(reviews, TODAY)).toBe(3);
  });

  it("is forgiving about the current month before it's reviewed yet", () => {
    const reviews = [monthsAgo(1), monthsAgo(2)];
    expect(calculateMonthlyReviewStreak(reviews, TODAY)).toBe(2);
  });

  it("returns 0 with no review history — a neutral count, not a warning state", () => {
    expect(calculateMonthlyReviewStreak([], TODAY)).toBe(0);
  });
});
