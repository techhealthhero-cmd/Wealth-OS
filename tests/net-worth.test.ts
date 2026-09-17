import { describe, expect, it } from "vitest";

import { calculateNetWorth, calculateNetWorthChange } from "@/lib/financial/net-worth";

describe("calculateNetWorth", () => {
  it("sums included account balances plus included, unlinked manual assets, minus included liabilities", () => {
    const result = calculateNetWorth(
      [{ balanceCents: 1000000, includeInNetWorth: true }],
      [{ valueCents: 500000, includeInNetWorth: true, linkedAccountId: null }],
      [{ balanceCents: 200000, includeInNetWorth: true, linkedAccountId: null }]
    );
    expect(result.totalAssetsCents).toBe(1500000);
    expect(result.totalLiabilitiesCents).toBe(200000);
    expect(result.netWorthCents).toBe(1300000);
  });

  it("excludes accounts/assets/liabilities with includeInNetWorth = false", () => {
    const result = calculateNetWorth(
      [{ balanceCents: 1000000, includeInNetWorth: false }],
      [{ valueCents: 500000, includeInNetWorth: false, linkedAccountId: null }],
      [{ balanceCents: 200000, includeInNetWorth: false, linkedAccountId: null }]
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
      [{ balanceCents: 500000, includeInNetWorth: true, linkedAccountId: null }]
    );
    expect(result.netWorthCents).toBe(-400000);
  });

  describe("credit card account semantics (see CLAUDE.md 'CREDIT CARD ACCOUNT SEMANTICS')", () => {
    it("a credit-card account's negative balance (unpaid purchases) reduces net worth by the same amount a liability would", () => {
      // accounts.account_type = 'credit_card' uses the same uniform, signed
      // ledger as every other account — an expense transaction debits it,
      // so its current_balance is expected to go negative as purchases
      // accumulate. That negative balance must reduce Net Worth correctly
      // with no special-casing, since calculateNetWorth() sums account
      // balances with their real sign.
      const viaCreditCardAccount = calculateNetWorth(
        [
          { balanceCents: 1000000, includeInNetWorth: true }, // e.g. a bank account
          { balanceCents: -300000, includeInNetWorth: true }, // credit card account, ฿3,000 owed
        ],
        [],
        []
      );
      const viaLiabilityInstead = calculateNetWorth(
        [{ balanceCents: 1000000, includeInNetWorth: true }],
        [],
        [{ balanceCents: 300000, includeInNetWorth: true, linkedAccountId: null }] // same ฿3,000 debt, tracked as a liability
      );
      expect(viaCreditCardAccount.netWorthCents).toBe(viaLiabilityInstead.netWorthCents);
      expect(viaCreditCardAccount.netWorthCents).toBe(700000);
    });

    it("without linking: the same physical card tracked as both an account and a liability is still subtracted twice", () => {
      // Linking is optional (Phase 15: "do not make linking mandatory") — a
      // user who tracks the same card in both places WITHOUT linking them
      // still gets double-counted. This is expected, not a bug: the app
      // cannot know two unlinked rows represent the same real debt.
      const doubleCounted = calculateNetWorth(
        [
          { balanceCents: 1000000, includeInNetWorth: true },
          { balanceCents: -300000, includeInNetWorth: true }, // same card as an account...
        ],
        [],
        [{ balanceCents: 300000, includeInNetWorth: true, linkedAccountId: null }] // ...and again as an unlinked liability
      );
      // Correct net worth (card tracked only once) would be 700000 — double
      // counting understates it by the full debt amount.
      expect(doubleCounted.netWorthCents).toBe(400000);
    });

    it("linking the liability to its credit-card account fixes the double-count (migration 0013)", () => {
      const linked = calculateNetWorth(
        [
          { balanceCents: 1000000, includeInNetWorth: true },
          { balanceCents: -300000, includeInNetWorth: true }, // credit card account, ฿3,000 owed
        ],
        [],
        [{ balanceCents: 300000, includeInNetWorth: true, linkedAccountId: "acc-cc-1" }] // linked to that same account
      );
      // The linked liability is excluded from totalLiabilitiesCents — the
      // account's negative balance already counts the debt once.
      expect(linked.totalLiabilitiesCents).toBe(0);
      expect(linked.netWorthCents).toBe(700000);
    });

    it("a mismatched linked liability balance does not get silently reconciled — the account balance alone is authoritative for Net Worth", () => {
      // Documents the chosen rule (CLAUDE.md "LIABILITY <-> ACCOUNT LINKING",
      // Phase 12/14): when linked, the ACCOUNT's ledger balance is what
      // counts toward Net Worth; the liability's own `balance` field is
      // simply excluded from the total, whatever value it holds — no
      // averaging, no "whichever is bigger," no auto-sync. A real mismatch
      // (e.g. accrued interest not yet logged as a transaction) is a data
      // quality signal for the UI to surface, not something this function
      // resolves on its own.
      const linkedWithMismatch = calculateNetWorth(
        [{ balanceCents: -1800000, includeInNetWorth: true }], // account says ฿18,000 owed
        [],
        [{ balanceCents: 2000000, includeInNetWorth: true, linkedAccountId: "acc-cc-1" }] // liability says ฿20,000
      );
      expect(linkedWithMismatch.totalLiabilitiesCents).toBe(0);
      expect(linkedWithMismatch.netWorthCents).toBe(-1800000);
    });
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
