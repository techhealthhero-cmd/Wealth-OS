import { describe, expect, it } from "vitest";

import {
  aggregateIncomeBySource,
  getHistoryMonthKeys,
  getIncomeQueryRange,
  getMonthProgress,
  shiftMonthKey,
  toTrackingStartMonth,
  type AggregateIncomeBySourceInput,
  type IncomeSourceTransaction,
} from "@/features/dashboard/lib/income-by-source";
import { fetchAllPages, fetchInBatches } from "@/features/dashboard/lib/paged-fetch";
import { todayInTimeZone } from "@/lib/date";

const TODAY = "2026-10-19";
const HISTORY = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

let seq = 0;
function tx(date: string, amount: string, categoryId: string | null = null, type: IncomeSourceTransaction["type"] = "income"): IncomeSourceTransaction {
  seq += 1;
  return { id: `tx-${seq}`, type, amount, transaction_date: date, category_id: categoryId };
}

function run(overrides: Partial<AggregateIncomeBySourceInput>) {
  return aggregateIncomeBySource({
    today: TODAY,
    transactions: [],
    trackingStartMonth: null,
    pathLinks: new Map(),
    categoryNames: new Map([
      ["cat-design", "Design"],
      ["cat-shop", "Shop"],
      ["cat-tutor", "Tutoring"],
      ["cat-int", "Interest"],
      ["cat-gift", "Gift"],
      ["cat-misc", "Misc"],
    ]),
    labels: { uncategorized: "Uncategorized", other: "Other" },
    ...overrides,
  });
}

describe("month key helpers", () => {
  it("shifts across year boundaries", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2025-12", 1)).toBe("2026-01");
    expect(shiftMonthKey("2026-03", -6)).toBe("2025-09");
  });

  it("returns the 6 previous complete months, oldest first", () => {
    expect(getHistoryMonthKeys(TODAY)).toEqual(HISTORY);
  });

  it("maps the earliest transaction date to a tracking start month", () => {
    expect(toTrackingStartMonth("2025-12-31")).toBe("2025-12");
    expect(toTrackingStartMonth(null)).toBeNull();
    expect(toTrackingStartMonth(undefined)).toBeNull();
  });
});

describe("user-calendar 'today' at Bangkok boundaries", () => {
  // Bangkok is UTC+7: 17:00Z is local midnight of the next day.
  const bangkok = (iso: string) => todayInTimeZone("Asia/Bangkok", new Date(iso));

  it("rolls into the new month at Bangkok midnight while UTC is still in the old one", () => {
    const today = bangkok("2026-10-31T17:30:00Z"); // 00:30 Nov 1 in Bangkok
    expect(today).toBe("2026-11-01");
    expect(getIncomeQueryRange(today)).toEqual({ from: "2026-05-01", to: "2026-11-01" });
    expect(getHistoryMonthKeys(today)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(getMonthProgress(today).daysLeft).toBe(29);

    // One minute earlier it is still Oct 31 in Bangkok.
    const before = bangkok("2026-10-31T16:59:00Z");
    expect(before).toBe("2026-10-31");
    expect(getMonthProgress(before).daysLeft).toBe(0);
    expect(getIncomeQueryRange(before).from).toBe("2026-04-01");
  });

  it("crosses the year boundary", () => {
    const today = bangkok("2026-12-31T17:05:00Z"); // 00:05 Jan 1 2027 in Bangkok
    expect(today).toBe("2027-01-01");
    expect(getHistoryMonthKeys(today)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
    expect(getIncomeQueryRange(today)).toEqual({ from: "2026-07-01", to: "2027-01-01" });
    const { daysLeft, monthDate } = getMonthProgress(today);
    expect(daysLeft).toBe(30);
    expect(new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate)).toBe(
      "January 2027"
    );
  });

  it("counts a transaction dated the Bangkok day as this month in the aggregator", () => {
    const today = bangkok("2026-10-31T17:30:00Z"); // 2026-11-01
    const result = run({
      today,
      transactions: [tx("2026-11-01", "500.00", "cat-design"), tx("2026-10-31", "1000.00", "cat-design")],
      trackingStartMonth: "2026-10",
    });
    expect(result.monthKey).toBe("2026-11");
    expect(result.thisMonthCents).toBe(50000);
    expect(result.monthlyTotals).toEqual([{ monthKey: "2026-10", incomeCents: 100000 }]);
  });

  it("handles leap-year February month length", () => {
    expect(getMonthProgress("2028-02-10").daysLeft).toBe(19);
    expect(getMonthProgress("2027-02-10").daysLeft).toBe(18);
  });
});

describe("paged fetch helpers", () => {
  it("pages until a short page, passing inclusive ranges", async () => {
    const all = Array.from({ length: 2345 }, (_, i) => i);
    const calls: [number, number][] = [];
    const rows = await fetchAllPages(async (from, to) => {
      calls.push([from, to]);
      return all.slice(from, to + 1);
    });
    expect(rows).toEqual(all);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("makes one extra empty request when the total is an exact multiple of the page size", async () => {
    const all = Array.from({ length: 4 }, (_, i) => i);
    let calls = 0;
    const rows = await fetchAllPages(async (from, to) => {
      calls += 1;
      return all.slice(from, to + 1);
    }, 2);
    expect(rows).toEqual(all);
    expect(calls).toBe(3);
  });

  it("propagates fetcher errors", async () => {
    await expect(
      fetchAllPages(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
  });

  it("batches ids (200 by default) and concatenates results", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `id-${i}`);
    const sizes: number[] = [];
    const rows = await fetchInBatches(ids, async (batch) => {
      sizes.push(batch.length);
      return batch.map((id) => ({ id }));
    });
    expect(sizes).toEqual([200, 200, 50]);
    expect(rows.map((r) => r.id)).toEqual(ids);
  });

  it("makes no request for an empty id list", async () => {
    let calls = 0;
    const rows = await fetchInBatches([], async () => {
      calls += 1;
      return [];
    });
    expect(rows).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe("aggregateIncomeBySource", () => {
  it("no history: this month only, every comparison metric is null", () => {
    const result = run({
      transactions: [tx("2026-10-02", "1000.00", "cat-design"), tx("2026-10-05", "500.50", "cat-shop")],
      trackingStartMonth: "2026-10",
    });
    expect(result.monthKey).toBe("2026-10");
    expect(result.thisMonthCents).toBe(150050);
    expect(result.monthsInWindow).toBe(0);
    expect(result.windowStartMonth).toBeNull();
    expect(result.averageCents).toBeNull();
    expect(result.receivedPercentOfAverage).toBeNull();
    expect(result.gapToAverageCents).toBeNull();
    expect(result.range).toBeNull();
    expect(result.volatility).toBeNull();
    expect(result.concentration).toBeNull();
    // Ranked by this month when there is no history.
    expect(result.groups.map((g) => g.name)).toEqual(["Design", "Shop"]);
    expect(result.groups.every((g) => g.sharePercent === null && g.percentOfAverage === null)).toBe(true);
  });

  it("empty input yields zero totals and no groups", () => {
    const result = run({});
    expect(result.thisMonthCents).toBe(0);
    expect(result.monthsInWindow).toBe(0);
    expect(result.groups).toEqual([]);
  });

  it("ignores non-income types, transactions after today, and months outside the window", () => {
    const result = run({
      transactions: [
        tx("2026-10-01", "100.00", "cat-design"),
        tx("2026-10-02", "999.00", "cat-design", "expense"),
        tx("2026-10-25", "300.00", "cat-design"),
        tx("2026-03-15", "700.00", "cat-design"),
      ],
      trackingStartMonth: "2026-03",
    });
    expect(result.thisMonthCents).toBe(10000);
    expect(result.groups[0].windowTotalCents).toBe(0);
  });

  it("1 month of history: average exists but % of average stays hidden", () => {
    const result = run({
      transactions: [tx("2026-09-10", "2000.00", "cat-design"), tx("2026-10-03", "1000.00", "cat-design")],
      trackingStartMonth: "2026-09",
    });
    expect(result.monthsInWindow).toBe(1);
    expect(result.windowStartMonth).toBe("2026-09");
    expect(result.averageCents).toBe(200000);
    expect(result.receivedPercentOfAverage).toBeNull();
    expect(result.groups[0].percentOfAverage).toBeNull();
    expect(result.groups[0].reachedAverage).toBe(false);
    expect(result.range).toBeNull();
    expect(result.concentration).toBeNull();
  });

  it("starts the window at the tracking start month; zero months inside it still count", () => {
    const result = run({
      transactions: [
        tx("2026-06-10", "3000.00", "cat-design"),
        // July and September have no income → zero months, still counted.
        tx("2026-08-10", "3000.00", "cat-design"),
        tx("2026-10-03", "1500.00", "cat-design"),
      ],
      trackingStartMonth: "2026-06",
    });
    expect(result.windowStartMonth).toBe("2026-06");
    expect(result.monthsInWindow).toBe(4);
    expect(result.monthlyTotals).toEqual([
      { monthKey: "2026-06", incomeCents: 300000 },
      { monthKey: "2026-07", incomeCents: 0 },
      { monthKey: "2026-08", incomeCents: 300000 },
      { monthKey: "2026-09", incomeCents: 0 },
    ]);
    expect(result.averageCents).toBe(150000);
    expect(result.receivedPercentOfAverage).toBe(100);
    expect(result.gapToAverageCents).toBeNull();
    expect(result.range).toEqual({ months: 4, minCents: 0, maxCents: 300000 });
  });

  it("tracking that started before the window means the whole 6-month window counts", () => {
    const result = run({
      transactions: [tx("2026-09-10", "600.00", "cat-design")],
      trackingStartMonth: "2025-12",
    });
    expect(result.monthsInWindow).toBe(6);
    expect(result.windowStartMonth).toBe("2026-04");
    expect(result.averageCents).toBe(10000);
  });

  it("established user tracking since January with income only in September → 6-month window", () => {
    // Earliest transaction (an expense, long before the window) sets the start;
    // only income rows inside the window are loaded.
    const result = run({
      transactions: [tx("2026-09-05", "6000.00", "cat-design"), tx("2026-10-04", "500.00", "cat-design")],
      trackingStartMonth: toTrackingStartMonth("2026-01-03"),
    });
    expect(result.monthsInWindow).toBe(6);
    expect(result.windowStartMonth).toBe("2026-04");
    expect(result.monthlyTotals.map((m) => m.incomeCents)).toEqual([0, 0, 0, 0, 0, 600000]);
    expect(result.averageCents).toBe(100000);
    expect(result.receivedPercentOfAverage).toBe(50);
    expect(result.gapToAverageCents).toBe(50000);
  });

  it("tracking that started this month gives no window even with older-looking input", () => {
    const result = run({
      transactions: [tx("2026-10-02", "100.00", "cat-design")],
      trackingStartMonth: "2026-10",
    });
    expect(result.monthsInWindow).toBe(0);
    expect(result.averageCents).toBeNull();
  });

  it("rounds averages and percentages to whole cents / whole percent", () => {
    const result = run({
      transactions: [
        tx("2026-07-01", "100.00", "cat-design"),
        tx("2026-08-01", "100.00", "cat-design"),
        tx("2026-09-01", "100.01", "cat-design"),
        tx("2026-10-01", "66.67", "cat-design"),
      ],
      trackingStartMonth: "2026-07",
    });
    // 30001 / 3 = 10000.33 → 10000
    expect(result.averageCents).toBe(10000);
    expect(Number.isInteger(result.averageCents)).toBe(true);
    // 6667 / 10000 = 66.67% → 67
    expect(result.receivedPercentOfAverage).toBe(67);
    expect(result.gapToAverageCents).toBe(3333);
    expect(result.groups[0].sharePercent).toBe(100);
  });

  it("single source: share 100%, at-average flag, concentration flagged", () => {
    const result = run({
      transactions: [
        tx("2026-08-01", "1000.00", "cat-design"),
        tx("2026-09-01", "1000.00", "cat-design"),
        tx("2026-10-01", "1200.00", "cat-design"),
      ],
      trackingStartMonth: "2026-08",
    });
    expect(result.groups).toHaveLength(1);
    const [design] = result.groups;
    expect(design.sharePercent).toBe(100);
    expect(design.percentOfAverage).toBe(120);
    expect(design.reachedAverage).toBe(true);
    expect(result.concentration).toEqual({ key: "category:cat-design", name: "Design", sharePercent: 100 });
  });

  it("groups by linked Earn path first, then category, then uncategorized", () => {
    const linked = tx("2026-10-01", "500.00", "cat-design");
    const unknownCategory = tx("2026-10-02", "200.00", "cat-deleted");
    const result = run({
      transactions: [linked, tx("2026-10-03", "300.00", "cat-design"), tx("2026-10-04", "100.00", null), unknownCategory],
      pathLinks: new Map([[linked.id, { pathId: "path-1", title: "Logo design" }]]),
    });
    const byKey = Object.fromEntries(result.groups.map((g) => [g.key, g]));
    expect(byKey["path:path-1"]).toMatchObject({ kind: "path", name: "Logo design", thisMonthCents: 50000 });
    expect(byKey["category:cat-design"]).toMatchObject({ kind: "category", thisMonthCents: 30000 });
    expect(byKey["uncategorized"]).toMatchObject({ kind: "uncategorized", name: "Uncategorized", thisMonthCents: 30000 });
  });

  it("never flags concentration on the uncategorized catch-all", () => {
    const result = run({
      transactions: [tx("2026-08-01", "900.00", null), tx("2026-09-01", "900.00", null), tx("2026-09-02", "100.00", "cat-shop")],
      trackingStartMonth: "2026-08",
    });
    expect(result.groups[0].kind).toBe("uncategorized");
    expect(result.concentration).toBeNull();
  });

  it("merges everything after the top 4 into Other with stable color slots", () => {
    const result = run({
      transactions: [
        tx("2026-09-01", "600.00", "cat-design"),
        tx("2026-09-01", "500.00", "cat-shop"),
        tx("2026-09-01", "400.00", "cat-tutor"),
        tx("2026-09-01", "300.00", "cat-int"),
        tx("2026-09-01", "150.00", "cat-gift"),
        tx("2026-09-01", "50.00", "cat-misc"),
        tx("2026-10-01", "80.00", "cat-gift"),
        tx("2026-10-01", "20.00", "cat-misc"),
      ],
      trackingStartMonth: "2026-08",
    });
    expect(result.groups.map((g) => g.name)).toEqual(["Design", "Shop", "Tutoring", "Interest", "Other"]);
    expect(result.groups.map((g) => g.colorSlot)).toEqual([0, 1, 2, 3, "other"]);
    const other = result.groups[4];
    expect(other.kind).toBe("other");
    expect(other.thisMonthCents).toBe(10000);
    expect(other.windowTotalCents).toBe(20000);
    expect(other.sharePercent).toBe(10);
    // Shares of the displayed groups add up to 100.
    expect(result.groups.reduce((s, g) => s + (g.sharePercent ?? 0), 0)).toBeCloseTo(100, 5);
    // 2000 / 2 months = 1000 avg; 600/1000 → Design has a 0 this month.
    expect(result.groups[0].thisMonthCents).toBe(0);
    expect(result.groups[0].percentOfAverage).toBe(0);
    expect(result.concentration).toBeNull();
  });

  it("concentration requires strictly more than 50% share and >= 2 months", () => {
    const flagged = run({
      transactions: [tx("2026-08-01", "500.00", "cat-design"), tx("2026-09-01", "500.00", "cat-shop"), tx("2026-09-02", "500.00", "cat-design")],
      trackingStartMonth: "2026-08",
    });
    expect(flagged.concentration).toMatchObject({ name: "Design", sharePercent: 66.7 });

    const exactlyHalf = run({
      transactions: [tx("2026-08-01", "500.00", "cat-design"), tx("2026-09-01", "500.00", "cat-shop")],
      trackingStartMonth: "2026-08",
    });
    expect(exactlyHalf.concentration).toBeNull();

    const justOverHalf = run({
      transactions: [tx("2026-08-01", "500.01", "cat-design"), tx("2026-09-01", "500.00", "cat-shop")],
      trackingStartMonth: "2026-08",
    });
    expect(justOverHalf.concentration?.name).toBe("Design");

    const below = run({
      transactions: [
        tx("2026-08-01", "400.00", "cat-design"),
        tx("2026-09-01", "300.00", "cat-shop"),
        tx("2026-09-01", "300.00", "cat-tutor"),
      ],
      trackingStartMonth: "2026-08",
    });
    expect(below.concentration).toBeNull();
  });

  describe("volatility", () => {
    function withMonths(values: string[]) {
      return run({
        transactions: values.map((v, i) => tx(`${HISTORY[HISTORY.length - values.length + i]}-15`, v, "cat-design")),
        trackingStartMonth: HISTORY[HISTORY.length - values.length],
      });
    }

    it("is hidden with fewer than 3 months", () => {
      expect(withMonths(["100.00", "200.00"]).volatility).toBeNull();
    });

    it("is hidden when the mean is 0", () => {
      const result = run({ trackingStartMonth: "2026-04" });
      expect(result.monthsInWindow).toBe(6);
      expect(result.volatility).toBeNull();
      expect(result.range).toEqual({ months: 6, minCents: 0, maxCents: 0 });
    });

    it("steady below 0.15", () => {
      // mean 100, stddev ~8.16 → 0.0816
      const result = withMonths(["90.00", "100.00", "110.00"]);
      expect(result.volatility?.level).toBe("steady");
    });

    it("moderate from 0.15 to below 0.35", () => {
      // values 85/100/115: stddev 12.25 → 0.1225 steady; 80/100/120: 16.33 → 0.163 moderate
      expect(withMonths(["80.00", "100.00", "120.00"]).volatility?.level).toBe("moderate");
      // 60/100/140: stddev 32.66 → 0.327 moderate
      expect(withMonths(["60.00", "100.00", "140.00"]).volatility?.level).toBe("moderate");
    });

    it("high at 0.35 and above", () => {
      // 50/100/150: stddev 40.82 → 0.408
      const result = withMonths(["50.00", "100.00", "150.00"]);
      expect(result.volatility?.level).toBe("high");
      expect(result.volatility?.coefficient).toBeCloseTo(0.408, 3);
    });

    it("exact threshold boundaries", () => {
      // two values a,b around mean m with population stddev = |a-b|/2.
      // 85/115 + 2 months of 100? Use 4 months: 85,115,85,115 → sd 15, mean 100 → 0.15 → moderate.
      expect(withMonths(["85.00", "115.00", "85.00", "115.00"]).volatility?.level).toBe("moderate");
      // 65,135,65,135 → sd 35 → 0.35 → high.
      expect(withMonths(["65.00", "135.00", "65.00", "135.00"]).volatility?.level).toBe("high");
    });
  });
});
