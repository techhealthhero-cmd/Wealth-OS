import { describe, expect, it } from "vitest";

import { categorizeUpcomingBills, deduplicateBillItems, type BillItem } from "@/lib/financial/upcoming-bills";
import { toLocalDateString } from "@/lib/date";

const TODAY = new Date(2026, 8, 15); // 2026-09-15

function iso(date: Date): string {
  return toLocalDateString(date);
}

function daysFromToday(days: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return iso(d);
}

function bill(overrides: Partial<BillItem>): BillItem {
  return {
    id: "1",
    source: "recurring",
    label: "Internet",
    amountCents: 60000,
    dueDate: daysFromToday(3),
    type: "expense",
    ...overrides,
  };
}

describe("categorizeUpcomingBills — date windows", () => {
  it("buckets an overdue item correctly", () => {
    const result = categorizeUpcomingBills([bill({ id: "1", dueDate: daysFromToday(-2) })], TODAY);
    expect(result.overdue).toHaveLength(1);
    expect(result.next7Days).toHaveLength(0);
  });

  it("buckets a due-today item as overdue-free but still due (not overdue, within 7 days)", () => {
    const result = categorizeUpcomingBills([bill({ id: "1", dueDate: daysFromToday(0) })], TODAY);
    expect(result.overdue).toHaveLength(0);
    expect(result.next7Days).toHaveLength(1);
  });

  it("buckets an item due in 5 days into next7Days", () => {
    const result = categorizeUpcomingBills([bill({ id: "1", dueDate: daysFromToday(5) })], TODAY);
    expect(result.next7Days).toHaveLength(1);
  });

  it("buckets an item due in 20 days into next30Days, not next7Days", () => {
    const result = categorizeUpcomingBills([bill({ id: "1", dueDate: daysFromToday(20) })], TODAY);
    expect(result.next7Days).toHaveLength(0);
    expect(result.next30Days).toHaveLength(1);
  });

  it("excludes an item due more than 30 days out entirely", () => {
    const result = categorizeUpcomingBills([bill({ id: "1", dueDate: daysFromToday(45) })], TODAY);
    expect(result.overdue).toHaveLength(0);
    expect(result.next7Days).toHaveLength(0);
    expect(result.next30Days).toHaveLength(0);
  });

  it("sums overdue + next7Days into totalDueCents, excluding next30Days", () => {
    const result = categorizeUpcomingBills(
      [
        bill({ id: "1", dueDate: daysFromToday(-1), amountCents: 10000 }),
        bill({ id: "2", dueDate: daysFromToday(3), amountCents: 20000 }),
        bill({ id: "3", dueDate: daysFromToday(20), amountCents: 99999 }),
      ],
      TODAY
    );
    expect(result.totalDueCents).toBe(30000);
  });
});

describe("deduplicateBillItems — duplicate obligation prevention", () => {
  it("collapses two items with the same label, due date, and amount", () => {
    const items = [
      bill({ id: "1", source: "recurring", label: "Internet Bill", amountCents: 60000, dueDate: "2026-09-20" }),
      bill({ id: "2", source: "liability", label: "internet bill", amountCents: 60000, dueDate: "2026-09-20" }),
    ];
    expect(deduplicateBillItems(items)).toHaveLength(1);
  });

  it("keeps two distinct bills that merely share a due date", () => {
    const items = [
      bill({ id: "1", label: "Internet", dueDate: "2026-09-20", amountCents: 60000 }),
      bill({ id: "2", label: "Electricity", dueDate: "2026-09-20", amountCents: 150000 }),
    ];
    expect(deduplicateBillItems(items)).toHaveLength(2);
  });

  it("keeps two same-label bills with different amounts (e.g. two different months' worth)", () => {
    const items = [
      bill({ id: "1", label: "Internet", dueDate: "2026-09-20", amountCents: 60000 }),
      bill({ id: "2", label: "Internet", dueDate: "2026-10-20", amountCents: 60000 }),
    ];
    expect(deduplicateBillItems(items)).toHaveLength(2);
  });
});
