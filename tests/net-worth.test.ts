import { describe, expect, it } from "vitest";

import { calculateNetWorth, calculateNetWorthChange } from "@/lib/financial/net-worth";

describe("calculateNetWorth", () => {
  it("sums included account balances plus included, unlinked manual assets, minus included liabilities", () => {
    const result = calculateNetWorth(
      [{ balanceCents: 1000000, includeInNetWorth: true }],
      [{ valueCents: 500000, includeInNetWorth: true, linkedAccountId: null }],
      [{ balanceCents: 200000, includeInNetWorth: true }]
    );
    expect(result.totalAssetsCents).toBe(1500000);
    expect(result.totalLiabilitiesCents).toBe(200000);
    expect(result.netWorthCents).toBe(1300000);
  });

  it("excludes accounts/assets/liabilities with includeInNetWorth = false", () => {
    const result = calculateNetWorth(
      [{ balanceCents: 1000000, includeInNetWorth: false }],
      [{ valueCents: 500000, includeInNetWorth: false, linkedAccountId: null }],
      [{ balanceCents: 200000, includeInNetWorth: false }]
    );
    expect(result.totalAssetsCents).toBe(0);
    expect(result.totalLiabilitiesCents).toBe(0);
    expect(result.netWorthCents).toBe(0);
  });

  it("never double-counts a manual asset linked to an account", () => {
    const result = calculateNetWorth(
      [{ balanceCents: 1000000, includeInNetWorth: true }],
      [{ valueCents: 1000000, includeInNetWorth: true, linkedAccountId: "acc-1" }],
      []
    );
    // The linked asset must be excluded — only the account's balance counts.
    expect(result.totalAssetsCents).toBe(1000000);
    expect(result.manualAssetsCents).toBe(0);
    expect(result.accountAssetsCents).toBe(1000000);
  });

  it("edge case: no assets and no liabilities at all", () => {
    const result = calculateNetWorth([], [], []);
    expect(result.netWorthCents).toBe(0);
  });

  it("edge case: liabilities greater than assets produces a negative net worth", () => {
    const result = calculateNetWorth(
      [{ balanceCents: 100000, includeInNetWorth: true }],
      [],
      [{ balanceCents: 500000, includeInNetWorth: true }]
    );
    expect(result.netWorthCents).toBe(-400000);
  });
});

describe("calculateNetWorthChange", () => {
  it("computes a positive change and percent", () => {
    const change = calculateNetWorthChange(1200000, 1000000);
    expect(change.changeCents).toBe(200000);
    expect(change.changePercent).toBeCloseTo(20);
  });

  it("computes a negative change", () => {
    const change = calculateNetWorthChange(800000, 1000000);
    expect(change.changeCents).toBe(-200000);
    expect(change.changePercent).toBeCloseTo(-20);
  });

  it("edge case: no history (previous = 0) returns a null percent rather than Infinity", () => {
    const change = calculateNetWorthChange(500000, 0);
    expect(change.changeCents).toBe(500000);
    expect(change.changePercent).toBeNull();
  });
});
