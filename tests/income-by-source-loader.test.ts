import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCategories: vi.fn(),
  captureError: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/observability", () => ({ captureError: mocks.captureError }));
vi.mock("@/features/categories/queries", () => ({ getCategories: mocks.getCategories }));
vi.mock("@/features/accounts/queries", () => ({ getDisplayAccounts: vi.fn() }));
vi.mock("@/features/transactions/queries", () => ({ getFinancialTransactions: vi.fn(), getTransactions: vi.fn() }));

import { getIncomeBySourceData } from "@/features/dashboard/queries";

function setup(linkFailureAt = -1, incomeError = false) {
  const transactions = Array.from({ length: 1001 }, (_, i) => ({
    id: `tx-${i}`, type: "income", amount: "1.00", category_id: "cat", transaction_date: "2026-10-01",
  }));
  const range = vi.fn(async (from: number, to: number) => ({
    data: transactions.slice(from, to + 1),
    error: incomeError ? { code: "XX000", message: "read failed" } : null,
  }));
  const links = vi.fn(async (_column: string, ids: string[]) => ({
    data: ids.map((id) => ({ transaction_id: id, income_path: { id: "path", title: "Earn" } })),
    error: links.mock.calls.length === linkFailureAt ? { code: "42501", message: "denied" } : null,
  }));
  const order = vi.fn();
  const gte = vi.fn();
  const lte = vi.fn();
  const builder = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte, lte, order,
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { transaction_date: "2020-01-01" }, error: null }),
    range, in: links,
  };
  order.mockReturnValue(builder);
  gte.mockReturnValue(builder);
  lte.mockReturnValue(builder);
  mocks.createClient.mockResolvedValue({ from: vi.fn(() => builder) });
  mocks.getCategories.mockResolvedValue([{ id: "cat", name_th: "หมวด", name_en: "Category" }]);
  return { range, links, order, gte, lte };
}

beforeEach(() => vi.resetAllMocks());

describe("income source loader", () => {
  it("loads beyond 1000 rows, scopes link batches, and counts linked income only once", async () => {
    const query = setup();
    const { summary } = await getIncomeBySourceData("en", "2026-10-19");
    expect(query.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(query.order.mock.calls).toContainEqual(["transaction_date", { ascending: true }]);
    expect(query.order.mock.calls).toContainEqual(["id", { ascending: true }]);
    expect(query.gte).toHaveBeenCalledWith("transaction_date", "2026-04-01");
    expect(query.lte).toHaveBeenCalledWith("transaction_date", "2026-10-19");
    expect(query.links.mock.calls.map((call) => call[1].length)).toEqual([200, 200, 200, 200, 200, 1]);
    expect(query.links.mock.calls.flatMap((call) => call[1])).toEqual(Array.from({ length: 1001 }, (_, i) => `tx-${i}`));
    expect(summary.thisMonthCents).toBe(100100);
    expect(summary.monthsInWindow).toBe(6);
    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0]).toMatchObject({ key: "path:path", thisMonthCents: 100100 });
  });

  it("falls back completely to localized categories when a later Earn batch fails", async () => {
    setup(2);
    const { summary } = await getIncomeBySourceData("th", "2026-10-19");
    expect(summary.thisMonthCents).toBe(100100);
    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0]).toMatchObject({ key: "category:cat", name: "หมวด", thisMonthCents: 100100 });
    expect(mocks.captureError).toHaveBeenCalledWith(expect.objectContaining({ code: "42501" }),
      expect.objectContaining({ operation: "load_earn_transaction_links" }));
  });

  it("rejects a failed income read instead of silently showing partial or zero income", async () => {
    const query = setup(-1, true);
    await expect(getIncomeBySourceData("en", "2026-10-19")).rejects.toThrow(/read failed|Failed to load income transactions/);
    expect(query.links).not.toHaveBeenCalled();
  });
});
