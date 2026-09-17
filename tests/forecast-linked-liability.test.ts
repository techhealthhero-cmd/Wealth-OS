import { beforeEach, describe, expect, it, vi } from "vitest";

import { getForecastStartingState } from "@/features/forecast/queries";

/**
 * Regression test for a real Forecast bug found during the production
 * promotion of Financial Data Integrity Hardening: `totalDebtCents` used
 * to include a linked liability's balance even though that same debt is
 * already reflected in `netWorthCents` via its linked account's negative
 * balance. `calculateForecast()`'s month-by-month projection would then
 * "pay off" that debt twice as the horizon progressed — once via the
 * shrinking `debt` variable, with no corresponding improvement to the
 * frozen "other net worth" baseline that also (implicitly) carries the
 * linked account's balance — inflating every projected month's net worth
 * once ANY debt payment was simulated, not just when balances mismatched.
 *
 * Fixed by excluding linked liabilities from `totalDebtCents`, mirroring
 * `calculateNetWorth()`'s own linking rule exactly.
 */

const mockAccounts = vi.fn();
const mockLiabilities = vi.fn();
const mockNetWorth = vi.fn();
const mockTransactions = vi.fn();

vi.mock("@/features/accounts/queries", () => ({
  getAccounts: () => mockAccounts(),
}));
vi.mock("@/features/liabilities/queries", () => ({
  getLiabilities: () => mockLiabilities(),
}));
vi.mock("@/features/net-worth/queries", () => ({
  getNetWorthBreakdown: () => mockNetWorth(),
}));
vi.mock("@/features/transactions/queries", () => ({
  getTransactions: () => mockTransactions(),
  getCurrentMonthRange: () => ({ from: "2026-09-01", to: "2026-09-30" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
}));

describe("getForecastStartingState — linked liability exclusion", () => {
  beforeEach(() => {
    mockAccounts.mockResolvedValue([]);
    mockNetWorth.mockResolvedValue({ netWorthCents: 700000 }); // e.g. already-correct linked-aware net worth
    mockTransactions.mockResolvedValue([{ id: "t1" }]); // non-empty, skips the "no history" fallback branch
  });

  it("excludes a linked liability's balance from totalDebtCents", async () => {
    mockLiabilities.mockResolvedValue([
      { balance: "20000", include_in_net_worth: true, linked_account_id: "acc-cc-1" }, // linked — must be excluded
      { balance: "5000", include_in_net_worth: true, linked_account_id: null }, // unlinked — must be included
    ]);

    const state = await getForecastStartingState();
    expect(state.totalDebtCents).toBe(500000); // only the unlinked ฿5,000 liability, in cents
  });

  it("includes all liabilities when none are linked (unchanged, pre-existing behavior)", async () => {
    mockLiabilities.mockResolvedValue([
      { balance: "5000", include_in_net_worth: true, linked_account_id: null },
      { balance: "3000", include_in_net_worth: true, linked_account_id: null },
    ]);

    const state = await getForecastStartingState();
    expect(state.totalDebtCents).toBe(800000);
  });

  it("still excludes liabilities with include_in_net_worth = false, independent of linking", async () => {
    mockLiabilities.mockResolvedValue([
      { balance: "5000", include_in_net_worth: false, linked_account_id: null },
      { balance: "3000", include_in_net_worth: true, linked_account_id: null },
    ]);

    const state = await getForecastStartingState();
    expect(state.totalDebtCents).toBe(300000);
  });
});
