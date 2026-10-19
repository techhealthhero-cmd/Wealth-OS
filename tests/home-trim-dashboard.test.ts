import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getDisplayAccounts: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/accounts/queries", () => ({ getDisplayAccounts: mocks.getDisplayAccounts }));

import { hasAnyDashboardData } from "@/features/dashboard/queries";

function txBuilder(rows: Array<{ id: string }> | null, error: unknown = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error }),
  };
  mocks.createClient.mockResolvedValue({ from: vi.fn(() => builder) });
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("hasAnyDashboardData", () => {
  it("returns true when any display account exists without querying transactions", async () => {
    mocks.getDisplayAccounts.mockResolvedValue([{ id: "a1" }]);
    const builder = txBuilder([{ id: "tx1" }]);

    await expect(hasAnyDashboardData("2026-10-19")).resolves.toBe(true);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(builder.limit).not.toHaveBeenCalled();
  });

  it("falls back to a single-row month transaction probe when there are no accounts", async () => {
    mocks.getDisplayAccounts.mockResolvedValue([]);
    const builder = txBuilder([{ id: "tx1" }]);

    await expect(hasAnyDashboardData("2026-10-19")).resolves.toBe(true);
    expect(builder.gte).toHaveBeenCalledWith("transaction_date", "2026-10-01");
    expect(builder.lte).toHaveBeenCalledWith("transaction_date", "2026-10-31");
    expect(builder.limit).toHaveBeenCalledWith(1);
  });

  it("returns false when there are no accounts and no transactions this month", async () => {
    mocks.getDisplayAccounts.mockResolvedValue([]);
    txBuilder([]);

    await expect(hasAnyDashboardData("2026-10-19")).resolves.toBe(false);
  });
});

describe("Home dashboard page trim", () => {
  const pageSource = readFileSync(
    path.join(process.cwd(), "src/app/(app)/dashboard/page.tsx"),
    "utf8"
  );

  it("keeps the core Home sections and drops the trimmed cards", () => {
    for (const keep of [
      "NetWorthHero",
      "HomeQuickActions",
      "HomeUpcomingTiles",
      "UpNextPayments",
      "IncomeThisMonth",
      "DailyInboxSection",
      "hasAnyDashboardData",
    ]) {
      expect(pageSource).toContain(keep);
    }

    for (const gone of [
      "HomeCushion",
      "MonthlyDonutCard",
      "GoalProgressCard",
      "EngagementSummaryCard",
      "DashboardDetailsToggle",
      "NextBestActionCard",
      "InsightCards",
      "WealthOverview",
      "getDashboardData",
      "getIncomeExpenseTrend",
    ]) {
      expect(pageSource).not.toContain(gone);
    }
  });
});
