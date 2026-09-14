import { describe, expect, it } from "vitest";

import { calculateNextDueDate, isDue, isOverdue, hasEnded } from "@/lib/financial/recurring";

function d(y: number, m: number, day: number): Date {
  return new Date(y, m - 1, day);
}

describe("calculateNextDueDate — per frequency", () => {
  it("adds 7 days for weekly", () => {
    expect(calculateNextDueDate(d(2026, 9, 1), "weekly")).toEqual(d(2026, 9, 8));
  });

  it("adds 14 days for biweekly", () => {
    expect(calculateNextDueDate(d(2026, 9, 1), "biweekly")).toEqual(d(2026, 9, 15));
  });

  it("adds one calendar month for monthly", () => {
    expect(calculateNextDueDate(d(2026, 9, 15), "monthly")).toEqual(d(2026, 10, 15));
  });

  it("adds three calendar months for quarterly", () => {
    expect(calculateNextDueDate(d(2026, 1, 15), "quarterly")).toEqual(d(2026, 4, 15));
  });

  it("adds one calendar year for yearly", () => {
    expect(calculateNextDueDate(d(2026, 9, 15), "yearly")).toEqual(d(2027, 9, 15));
  });

  it("clamps month-end overflow correctly (Jan 31 + monthly -> Feb 28 in a non-leap year)", () => {
    expect(calculateNextDueDate(d(2026, 1, 31), "monthly")).toEqual(d(2026, 2, 28));
  });

  it("clamps for a leap year February", () => {
    expect(calculateNextDueDate(d(2027, 1, 31), "monthly")).toEqual(d(2027, 2, 28));
    expect(calculateNextDueDate(d(2028, 1, 31), "monthly")).toEqual(d(2028, 2, 29)); // 2028 is a leap year
  });
});

describe("isDue / isOverdue", () => {
  const today = d(2026, 9, 15);

  it("is due when the date is today or in the past", () => {
    expect(isDue(d(2026, 9, 15), today)).toBe(true);
    expect(isDue(d(2026, 9, 10), today)).toBe(true);
  });

  it("is not due when the date is in the future", () => {
    expect(isDue(d(2026, 9, 16), today)).toBe(false);
  });

  it("is overdue only when strictly in the past (today itself is due, not overdue)", () => {
    expect(isOverdue(d(2026, 9, 15), today)).toBe(false);
    expect(isOverdue(d(2026, 9, 14), today)).toBe(true);
  });
});

describe("hasEnded — end-date handling", () => {
  it("has not ended when there is no end date at all", () => {
    expect(hasEnded(null, d(2026, 9, 15))).toBe(false);
  });

  it("has not ended when the end date is today or in the future", () => {
    expect(hasEnded(d(2026, 9, 15), d(2026, 9, 15))).toBe(false);
    expect(hasEnded(d(2026, 9, 20), d(2026, 9, 15))).toBe(false);
  });

  it("has ended once the end date is strictly in the past", () => {
    expect(hasEnded(d(2026, 9, 10), d(2026, 9, 15))).toBe(true);
  });
});
