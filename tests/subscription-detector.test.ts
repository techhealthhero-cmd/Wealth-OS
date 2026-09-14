import { describe, expect, it } from "vitest";

import { detectSubscriptions, calculateAnnualizedCostCents } from "@/lib/financial/subscription-detector";

function d(y: number, m: number, day: number): Date {
  return new Date(y, m - 1, day);
}

describe("detectSubscriptions — monthly recurring merchant", () => {
  it("detects a consistent monthly charge with high confidence at 4+ occurrences", () => {
    const transactions = [
      { merchant: "Netflix", amountCents: 35000, date: d(2026, 6, 5) },
      { merchant: "Netflix", amountCents: 35000, date: d(2026, 7, 5) },
      { merchant: "Netflix", amountCents: 35000, date: d(2026, 8, 5) },
      { merchant: "Netflix", amountCents: 35000, date: d(2026, 9, 5) },
    ];
    const results = detectSubscriptions(transactions);
    expect(results).toHaveLength(1);
    expect(results[0].merchant).toBe("Netflix");
    expect(results[0].frequency).toBe("monthly");
    expect(results[0].confidence).toBe("high");
    expect(results[0].estimatedAmountCents).toBe(35000);
    expect(results[0].occurrenceCount).toBe(4);
  });
});

describe("detectSubscriptions — weekly recurring merchant", () => {
  it("detects a weekly cadence", () => {
    const transactions = [
      { merchant: "Coffee Club", amountCents: 12000, date: d(2026, 9, 1) },
      { merchant: "Coffee Club", amountCents: 12000, date: d(2026, 9, 8) },
      { merchant: "Coffee Club", amountCents: 12000, date: d(2026, 9, 15) },
    ];
    const results = detectSubscriptions(transactions);
    expect(results[0].frequency).toBe("weekly");
    expect(results[0].confidence).toBe("medium"); // 3 occurrences, consistent gaps
  });
});

describe("detectSubscriptions — amount variance", () => {
  it("still detects with slightly varying amounts within tolerance", () => {
    const transactions = [
      { merchant: "Gym", amountCents: 100000, date: d(2026, 6, 1) },
      { merchant: "Gym", amountCents: 102000, date: d(2026, 7, 1) },
      { merchant: "Gym", amountCents: 99000, date: d(2026, 8, 1) },
      { merchant: "Gym", amountCents: 101000, date: d(2026, 9, 1) },
    ];
    const results = detectSubscriptions(transactions);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe("high");
  });

  it("rejects wildly different amounts from the same merchant as not a real subscription pattern", () => {
    const transactions = [
      { merchant: "Corner Store", amountCents: 5000, date: d(2026, 6, 1) },
      { merchant: "Corner Store", amountCents: 500000, date: d(2026, 7, 1) },
      { merchant: "Corner Store", amountCents: 3000, date: d(2026, 8, 1) },
    ];
    expect(detectSubscriptions(transactions)).toEqual([]);
  });
});

describe("detectSubscriptions — false positive resistance", () => {
  it("never flags a merchant from a single transaction", () => {
    const transactions = [{ merchant: "One-off Purchase", amountCents: 50000, date: d(2026, 9, 1) }];
    expect(detectSubscriptions(transactions)).toEqual([]);
  });

  it("does not flag two purchases with no recognizable recurring interval", () => {
    const transactions = [
      { merchant: "Random Shop", amountCents: 20000, date: d(2026, 1, 1) },
      { merchant: "Random Shop", amountCents: 20000, date: d(2026, 9, 15) }, // ~8 months apart, matches no band
    ];
    expect(detectSubscriptions(transactions)).toEqual([]);
  });

  it("ignores transactions with no merchant recorded", () => {
    const transactions = [
      { merchant: "", amountCents: 10000, date: d(2026, 8, 1) },
      { merchant: "", amountCents: 10000, date: d(2026, 9, 1) },
    ];
    expect(detectSubscriptions(transactions)).toEqual([]);
  });
});

describe("calculateAnnualizedCostCents", () => {
  it("multiplies by the correct occurrence count per year", () => {
    expect(calculateAnnualizedCostCents(35000, "monthly")).toBe(420000);
    expect(calculateAnnualizedCostCents(10000, "weekly")).toBe(520000);
    expect(calculateAnnualizedCostCents(100000, "yearly")).toBe(100000);
  });
});
