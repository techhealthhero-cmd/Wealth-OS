import { describe, expect, it } from "vitest";

import { formatMonthHeading, groupTransactionsByMonthAndDay } from "@/lib/transaction-ui";

const tx = (id: string, transaction_date: string) => ({ id, transaction_date });

describe("groupTransactionsByMonthAndDay", () => {
  it("groups a newest-first list into month → day sections, keeping order", () => {
    const groups = groupTransactionsByMonthAndDay([
      tx("a", "2026-10-20"),
      tx("b", "2026-10-20"),
      tx("c", "2026-10-19"),
      tx("d", "2026-09-20"),
      tx("e", "2026-09-19"),
      tx("f", "2026-09-19"),
    ]);

    expect(groups.map((m) => m.month)).toEqual(["2026-10", "2026-09"]);
    expect(groups[0].days.map((d) => [d.date, d.items.map((i) => i.id)])).toEqual([
      ["2026-10-20", ["a", "b"]],
      ["2026-10-19", ["c"]],
    ]);
    expect(groups[1].days.map((d) => [d.date, d.items.map((i) => i.id)])).toEqual([
      ["2026-09-20", ["d"]],
      ["2026-09-19", ["e", "f"]],
    ]);
  });

  it("handles full timestamps and an empty list", () => {
    expect(groupTransactionsByMonthAndDay([tx("a", "2026-10-03T08:00:00Z")])[0].days[0].date).toBe("2026-10-03");
    expect(groupTransactionsByMonthAndDay([])).toEqual([]);
  });
});

describe("formatMonthHeading", () => {
  it("shows the Thai month name and Buddhist year", () => {
    expect(formatMonthHeading("2026-10", "th")).toBe("ตุลาคม 2569");
    expect(formatMonthHeading("2026-10", "en")).toBe("October 2026");
  });
});
