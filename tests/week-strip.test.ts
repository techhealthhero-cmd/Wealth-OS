import { describe, expect, it } from "vitest";

import { addDaysIso, buildWeekStrip, isIsoDate, weekStartOf } from "@/lib/financial/week-strip";

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

  it("marks days after today as future", () => {
    const days = buildWeekStrip("2026-10-05", "2026-10-07", [], []);
    expect(days.map((d) => d.isFuture)).toEqual([false, false, false, true, true, true, true]);
  });
});
