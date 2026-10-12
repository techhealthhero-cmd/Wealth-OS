import { describe, expect, it } from "vitest";

import {
  addDaysIso,
  addMonthsIso,
  buildMonthGrid,
  buildWeekStrip,
  isIsoDate,
  isIsoMonth,
  monthGridRange,
  weekStartOf,
} from "@/lib/financial/week-strip";

describe("week strip", () => {
  it("weeks start on Monday", () => {
    expect(weekStartOf("2026-10-11")).toBe("2026-10-05"); // Sunday → previous Monday
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(weekStartOf("2026-10-01")).toBe("2026-09-28"); // across a month
  });

  it("adds days across months and years", () => {
    expect(addDaysIso("2026-12-29", 7)).toBe("2027-01-05");
    expect(addDaysIso("2026-10-05", -7)).toBe("2026-09-28");
  });

  it("validates real calendar dates only", () => {
    expect(isIsoDate("2026-10-11")).toBe(true);
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("11/10/2026")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it("sums each day's spending net of refunds, ignoring income and transfers", () => {
    const days = buildWeekStrip(
      "2026-10-05",
      "2026-10-11",
      [
        { transaction_date: "2026-10-05", type: "expense", amount: "50.00" },
        { transaction_date: "2026-10-05", type: "expense", amount: "44" },
        { transaction_date: "2026-10-05", type: "refund", amount: "4" },
        { transaction_date: "2026-10-05", type: "income", amount: "2000" },
        { transaction_date: "2026-10-05", type: "transfer", amount: "500" },
        { transaction_date: "2026-10-11", type: "expense", amount: "80" },
      ],
      ["2026-10-11", "2026-09-30"]
    );
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.spentCents)).toEqual([9_000, 0, 0, 0, 0, 0, 8_000]);
    // Net = income − spending; transfers still count for nothing.
    expect(days.map((d) => d.netCents)).toEqual([191_000, 0, 0, 0, 0, 0, -8_000]);
    expect(days[6]).toMatchObject({ date: "2026-10-11", hasPending: true, isToday: true, isFuture: false });
    expect(days[0].hasPending).toBe(false);
  });

  it("builds the wall calendar's month in whole Monday-to-Sunday weeks", () => {
    // October 2026 starts on a Thursday and ends on a Saturday: Sep 28 → Nov 1.
    expect(monthGridRange("2026-10")).toEqual({ start: "2026-09-28", end: "2026-11-01" });
    // February 2027 runs Mon Feb 1 … Sun Feb 28: exactly 4 rows.
    expect(monthGridRange("2027-02")).toEqual({ start: "2027-02-01", end: "2027-02-28" });
    // March 2026 starts on a Sunday: 6 rows.
    expect(monthGridRange("2026-03")).toEqual({ start: "2026-02-23", end: "2026-04-05" });

    const grid = buildMonthGrid(
      "2026-10",
      "2026-10-12",
      [
        { transaction_date: "2026-10-11", type: "income", amount: "2000" },
        { transaction_date: "2026-10-11", type: "expense", amount: "843" },
        { transaction_date: "2026-10-02", type: "expense", amount: "100" },
        { transaction_date: "2026-09-29", type: "expense", amount: "5000" }, // September: not in the month's net
        { transaction_date: "2026-10-20", type: "expense", amount: "999" }, // future-dated: ignored
      ],
      ["2026-10-02"]
    );
    expect(grid.weeks).toHaveLength(5);
    expect(grid.weeks[0][0]).toMatchObject({ date: "2026-09-28", inMonth: false });
    expect(grid.weeks[0][3]).toMatchObject({ date: "2026-10-01", inMonth: true });
    expect(grid.weeks[0][4]).toMatchObject({ netCents: -10_000, hasPending: true });
    expect(grid.netCents).toBe(200_000 - 84_300 - 10_000);
    expect(grid.maxSpentCents).toBe(500_000);
    expect(grid.focusRow).toBe(2); // Oct 12 is in the third week
  });

  it("focuses a past month's last row and steps months across years", () => {
    expect(buildMonthGrid("2026-09", "2026-10-12", [], []).focusRow).toBe(4);
    expect(addMonthsIso("2026-12", 1)).toBe("2027-01");
    expect(addMonthsIso("2026-01", -1)).toBe("2025-12");
    expect(isIsoMonth("2026-10")).toBe(true);
    expect(isIsoMonth("2026-13")).toBe(false);
    expect(isIsoMonth("2026-10-01")).toBe(false);
  });

  it("marks days after today as future", () => {
    const days = buildWeekStrip("2026-10-05", "2026-10-07", [], []);
    expect(days.map((d) => d.isFuture)).toEqual([false, false, false, true, true, true, true]);
  });
});
