import { describe, expect, it } from "vitest";

import {
  buildMonthPayments,
  daysBetween,
  dedupeOccurrences,
  firstUnpaidDate,
  daysInMonth,
  monthGrid,
  nextPayments,
  projectDueDates,
  shiftMonth,
  summarizeMonthPayments,
  type PaymentSource,
} from "@/lib/financial/payment-calendar";

function source(overrides: Partial<PaymentSource>): PaymentSource {
  return {
    id: "r1",
    label: "Netflix",
    kind: "expense",
    amountCents: 41900,
    frequency: "monthly",
    nextDueDate: "2026-10-22",
    endDate: null,
    active: true,
    paid: [],
    ...overrides,
  };
}

describe("month helpers", () => {
  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", -12)).toBe("2025-10");
  });

  it("knows month lengths incl. leap years", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-10")).toBe(31);
  });

  it("counts calendar days in both directions", () => {
    expect(daysBetween("2026-10-19", "2026-10-19")).toBe(0);
    expect(daysBetween("2026-10-19", "2026-10-22")).toBe(3);
    expect(daysBetween("2026-10-19", "2026-10-12")).toBe(-7);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("builds Sunday-first full weeks", () => {
    const grid = monthGrid("2026-10"); // Oct 1 2026 is a Thursday
    expect(grid).toHaveLength(35);
    expect(grid[0]).toEqual({ date: "2026-09-27", day: 27, inMonth: false });
    expect(grid[4]).toEqual({ date: "2026-10-01", day: 1, inMonth: true });
    expect(grid[34]).toEqual({ date: "2026-10-31", day: 31, inMonth: true });
    expect(grid.filter((c) => c.inMonth)).toHaveLength(31);
  });
});

describe("projectDueDates", () => {
  it("projects monthly items with month-end clamping like calculateNextDueDate", () => {
    expect(projectDueDates("2026-01-31", "monthly", null, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-28",
      "2026-04-28",
    ]);
  });

  it("returns every weekly occurrence in the window", () => {
    expect(projectDueDates("2026-10-05", "weekly", null, "2026-10-01", "2026-10-31")).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
  });

  it("skips dates before the window and stops after end_date", () => {
    expect(projectDueDates("2026-09-15", "biweekly", "2026-10-20", "2026-10-01", "2026-10-31")).toEqual(["2026-10-13"]);
  });

  it("yields a one-off date only when it falls in the window", () => {
    expect(projectDueDates("2026-10-25", null, null, "2026-10-01", "2026-10-31")).toEqual(["2026-10-25"]);
    expect(projectDueDates("2026-11-25", null, null, "2026-10-01", "2026-10-31")).toEqual([]);
  });

  it("does not show a yearly item in months it doesn't occur", () => {
    expect(projectDueDates("2026-10-27", "yearly", null, "2026-11-01", "2026-11-30")).toEqual([]);
    expect(projectDueDates("2026-10-27", "yearly", null, "2027-10-01", "2027-10-31")).toEqual(["2027-10-27"]);
  });
});


describe("buildMonthPayments + summarizeMonthPayments", () => {
  const sources: PaymentSource[] = [
    source({ id: "rent", label: "Rent", kind: "transfer", amountCents: 450000, nextDueDate: "2026-11-01", paid: [{ date: "2026-10-01", amountCents: 450000 }] }),
    source({ id: "spotify", label: "Spotify", amountCents: 14900, nextDueDate: "2026-11-08", paid: [{ date: "2026-10-08", amountCents: 14900 }] }),
    source({ id: "netflix", label: "Netflix", amountCents: 41900, nextDueDate: "2026-10-22" }),
    source({ id: "card", label: "Card", kind: "liability", amountCents: 100000, frequency: null, nextDueDate: "2026-10-25" }),
  ];

  it("combines verified paid dates with the unpaid projection, sorted by date", () => {
    expect(buildMonthPayments(sources, "2026-10").map((o) => [o.sourceId, o.date, o.paid])).toEqual([
      ["rent", "2026-10-01", true],
      ["spotify", "2026-10-08", true],
      ["netflix", "2026-10-22", false],
      ["card", "2026-10-25", false],
    ]);
  });

  it("only marks dates paid when a confirmed transaction exists (projection never implies payment)", () => {
    const nov = buildMonthPayments(sources, "2026-11");
    expect(nov.every((o) => !o.paid)).toBe(true);
    expect(nov.map((o) => o.sourceId)).toEqual(["rent", "spotify", "netflix"]);
  });

  it("uses the recorded transaction amount for paid occurrences, not the template's current amount", () => {
    const occ = buildMonthPayments([source({ amountCents: 45900, nextDueDate: "2026-11-08", paid: [{ date: "2026-10-08", amountCents: 41900 }] })], "2026-10");
    expect(occ).toEqual([expect.objectContaining({ date: "2026-10-08", paid: true, amountCents: 41900 })]);
  });

  it("shows paid occurrences on their recorded date even if the template's day/frequency was edited since", () => {
    // Paid on the 8th; schedule was later moved to the 20th.
    const occ = buildMonthPayments([source({ nextDueDate: "2026-11-20", paid: [{ date: "2026-10-08", amountCents: 41900 }] })], "2026-10");
    expect(occ.map((o) => [o.date, o.paid])).toEqual([["2026-10-08", true]]);
  });

  it("treats a verified next_due_date as paid (insert succeeded, schedule advance failed) without double-counting", () => {
    const occ = buildMonthPayments([source({ nextDueDate: "2026-10-12", paid: [{ date: "2026-10-12", amountCents: 41900 }] })], "2026-10");
    expect(occ).toHaveLength(1);
    expect(occ[0].paid).toBe(true);
  });

  it("never invents overdues from the template's past (deleted confirmations are not resurfaced)", () => {
    expect(buildMonthPayments([source({ nextDueDate: "2026-11-05" })], "2026-10")).toEqual([]);
  });

  it("keeps paid history of ended/archived schedules but projects nothing for them", () => {
    const ended = source({ active: false, nextDueDate: "2026-11-08", endDate: "2026-10-31", paid: [{ date: "2026-10-08", amountCents: 41900 }] });
    expect(buildMonthPayments([ended], "2026-10").map((o) => [o.date, o.paid])).toEqual([["2026-10-08", true]]);
    expect(buildMonthPayments([ended], "2026-11")).toEqual([]);
    expect(nextPayments([ended], 3)).toEqual([]);
  });

  it("sums totals, paid and left, with per-kind totals for kinds present", () => {
    expect(summarizeMonthPayments(buildMonthPayments(sources, "2026-10"))).toEqual({
      totalCents: 450000 + 14900 + 41900 + 100000,
      paidCents: 450000 + 14900,
      leftCents: 41900 + 100000,
      paidCount: 2,
      leftCount: 2,
      byKind: [
        { kind: "expense", cents: 14900 + 41900 },
        { kind: "transfer", cents: 450000 },
        { kind: "liability", cents: 100000 },
      ],
    });
  });

  it("is all zeros for an empty month", () => {
    expect(summarizeMonthPayments([])).toEqual({ totalCents: 0, paidCents: 0, leftCents: 0, paidCount: 0, leftCount: 0, byKind: [] });
  });
});

describe("occurrence-level dedup (same rule as the upcoming list)", () => {
  const rec = source({ id: "rec", label: "KTC Card", amountCents: 100000, nextDueDate: "2026-10-25", paid: [{ date: "2026-09-25", amountCents: 100000 }] });
  const liab = source({ id: "liab", label: "ktc card ", kind: "liability", amountCents: 100000, frequency: null, nextDueDate: "2026-10-25" });

  it("drops the liability duplicate of a recurring occurrence, recurring wins", () => {
    expect(buildMonthPayments([liab, rec], "2026-10").map((o) => o.sourceId)).toEqual(["rec"]);
  });

  it("keeps a non-matching liability (different amount)", () => {
    const other = { ...liab, id: "other", amountCents: 50000 };
    expect(buildMonthPayments([rec, other], "2026-10").map((o) => o.sourceId).sort()).toEqual(["other", "rec"]);
  });

  it("keeps all paid history of a source whose current occurrence is a duplicate", () => {
    const dupRec = { ...rec, id: "rec2", label: "KTC Card" };
    const sep = buildMonthPayments([rec, dupRec], "2026-09");
    expect(sep.filter((o) => o.paid)).toHaveLength(2);
  });

  it("drops an unpaid duplicate of a paid occurrence", () => {
    const paidRec = source({ id: "p", label: "KTC Card", amountCents: 100000, nextDueDate: "2026-11-25", paid: [{ date: "2026-10-25", amountCents: 100000 }] });
    expect(buildMonthPayments([liab, paidRec], "2026-10").map((o) => [o.sourceId, o.paid])).toEqual([["p", true]]);
  });

  it("applies to Home's next payments too", () => {
    expect(nextPayments([liab, rec], 3).map((o) => o.sourceId)).toEqual(["rec"]);
  });

  it("Home's next payments skip a liability duplicating a paid recurring occurrence", () => {
    const paidRec = source({ id: "p", label: "KTC Card", amountCents: 100000, nextDueDate: "2026-11-25", paid: [{ date: "2026-10-25", amountCents: 100000 }] });
    expect(nextPayments([liab, paidRec], 3).map((o) => [o.sourceId, o.date])).toEqual([["p", "2026-11-25"]]);
  });

  it("dedupeOccurrences never removes paid occurrences", () => {
    const occ = buildMonthPayments([rec], "2026-09");
    expect(dedupeOccurrences([...occ, ...occ.map((o) => ({ ...o, key: `${o.key}-copy` }))])).toHaveLength(2);
  });
});

describe("nextPayments / firstUnpaidDate", () => {
  it("orders by next due date (overdue first) and limits the count", () => {
    const next = nextPayments(
      [
        source({ id: "a", label: "A", nextDueDate: "2026-10-25" }),
        source({ id: "b", label: "B", nextDueDate: "2026-10-17" }),
        source({ id: "c", label: "C", nextDueDate: "2026-10-19" }),
        source({ id: "d", label: "D", nextDueDate: "2026-11-01" }),
      ],
      3
    );
    expect(next.map((o) => [o.sourceId, o.date])).toEqual([
      ["b", "2026-10-17"],
      ["c", "2026-10-19"],
      ["a", "2026-10-25"],
    ]);
    expect(next.every((o) => !o.paid)).toBe(true);
  });

  it("skips a verified-paid next_due_date and moves to the following occurrence", () => {
    expect(firstUnpaidDate(source({ nextDueDate: "2026-10-19", paid: [{ date: "2026-10-19", amountCents: 41900 }] }))).toBe("2026-11-19");
  });

  it("returns null for a paid one-off and past an end date", () => {
    expect(firstUnpaidDate(source({ frequency: null, nextDueDate: "2026-10-19", paid: [{ date: "2026-10-19", amountCents: 1 }] }))).toBeNull();
    expect(firstUnpaidDate(source({ nextDueDate: "2026-10-19", endDate: "2026-10-31", paid: [{ date: "2026-10-19", amountCents: 1 }] }))).toBeNull();
  });
});

describe("captured subscription schedules", () => {
  it("starts on NEXT due day and removes future occurrences after cancellation", () => {
    const captured = source({ label: "Grok Bot", amountCents: 107900, nextDueDate: "2026-11-19" });
    expect(buildMonthPayments([captured], "2026-10")).toEqual([]);
    expect(buildMonthPayments([captured], "2026-11")).toMatchObject([{ date: "2026-11-19", amountCents: 107900, paid: false }]);
    expect(buildMonthPayments([{ ...captured, active: false, endDate: "2026-10-19" }], "2026-11")).toEqual([]);
    expect(buildMonthPayments([{ ...captured, endDate: "2026-11-18" }], "2026-11")).toEqual([]);
  });
  it("projects yearly capture on its next anniversary", () => {
    const captured = source({ label: "iCloud", frequency: "yearly", nextDueDate: "2027-10-19" });
    expect(buildMonthPayments([captured], "2026-10")).toEqual([]);
    expect(buildMonthPayments([captured], "2027-10")).toMatchObject([{ date: "2027-10-19" }]);
  });
});
