import { describe, expect, it } from "vitest";

import { addMonthsClamped, toLocalDateString } from "@/lib/date";

describe("toLocalDateString", () => {
  it("formats a date as YYYY-MM-DD using local calendar fields", () => {
    expect(toLocalDateString(new Date(2026, 8, 1))).toBe("2026-09-01"); // month is 0-indexed
  });

  it("pads single-digit months and days", () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("never shifts to the previous day the way toISOString().slice(0, 10) can in UTC+ timezones", () => {
    // The exact bug this exists to prevent: constructing a local midnight
    // Date for the 1st of a month, then reading it back, must still say
    // the 1st — regardless of what timezone the test runner is in.
    const firstOfMonth = new Date(2026, 8, 1, 0, 0, 0);
    const result = toLocalDateString(firstOfMonth);
    expect(result).toBe("2026-09-01");
    expect(result.endsWith("-01")).toBe(true);
  });

  it("handles the last day of a month correctly", () => {
    expect(toLocalDateString(new Date(2026, 8, 30))).toBe("2026-09-30");
  });
});

describe("addMonthsClamped", () => {
  it("adds whole months in the simple case", () => {
    const result = addMonthsClamped(new Date(2026, 8, 17), 6); // Sep 17 + 6mo
    expect(toLocalDateString(result)).toBe("2027-03-17");
  });

  it("adds multi-year spans correctly (e.g. the 5-year income-target preset)", () => {
    const result = addMonthsClamped(new Date(2026, 8, 17), 60);
    expect(toLocalDateString(result)).toBe("2031-09-17");
  });

  it("clamps to the last real day of the target month instead of overflowing (Jan 31 + 1 month)", () => {
    const result = addMonthsClamped(new Date(2026, 0, 31), 1);
    expect(toLocalDateString(result)).toBe("2026-02-28"); // 2026 is not a leap year
  });

  it("clamps correctly into a leap-year February", () => {
    const result = addMonthsClamped(new Date(2027, 0, 31), 13); // Jan 31 2027 + 13mo -> Feb 2028 (leap)
    expect(toLocalDateString(result)).toBe("2028-02-29");
  });

  it("adding 0 months returns the same calendar date", () => {
    const result = addMonthsClamped(new Date(2026, 8, 17), 0);
    expect(toLocalDateString(result)).toBe("2026-09-17");
  });
});
