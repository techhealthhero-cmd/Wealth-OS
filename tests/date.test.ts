import { describe, expect, it } from "vitest";

import { toLocalDateString } from "@/lib/date";

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
