import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildMonthlyHealthCheck } from "@/features/ai/lib/health-check";
import type { BudgetStatusTool, NetWorthTool, PriorityTool } from "@/features/ai/types";

interface FakeTx {
  type: "income" | "expense" | "debt_payment" | "refund";
  amount: string;
}

let currentMonthTx: FakeTx[] = [];
let previousMonthTx: FakeTx[] = [];
let budgetStatus: BudgetStatusTool = { hasBudget: false };
let netWorth: NetWorthTool = { netWorthCents: 0, totalAssetsCents: 0, totalLiabilitiesCents: 0, changeVsPreviousCents: null };
let priority: PriorityTool | null = null;

vi.mock("@/features/transactions/queries", () => ({
  getCurrentMonthRange: vi.fn(() => ({ from: "2026-09-01", to: "2026-09-30" })),
  getTransactions: vi.fn(async (filters: { from: string }) => (filters.from === "2026-09-01" ? currentMonthTx : previousMonthTx)),
}));

vi.mock("@/features/ai/tools", () => ({
  getBudgetStatus: vi.fn(async () => budgetStatus),
  getNetWorthSummary: vi.fn(async () => netWorth),
  getFinancialPriority: vi.fn(async () => priority),
}));

function tx(type: FakeTx["type"], amount: string): FakeTx {
  return { type, amount };
}

describe("buildMonthlyHealthCheck — structure", () => {
  beforeEach(() => {
    currentMonthTx = [];
    previousMonthTx = [];
    budgetStatus = { hasBudget: false };
    netWorth = { netWorthCents: 0, totalAssetsCents: 0, totalLiabilitiesCents: 0, changeVsPreviousCents: null };
    priority = null;
  });

  it("reports hasEnoughData=false when there is no prior-month history to compare against, rather than fabricating a status", async () => {
    currentMonthTx = [tx("income", "10000.00")];
    previousMonthTx = [];

    const result = await buildMonthlyHealthCheck();
    expect(result.hasEnoughData).toBe(false);
    expect(result.positives).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.changes).toEqual([]);
  });

  it("flags negative cash flow as both a risk and needs_attention overall status", async () => {
    currentMonthTx = [tx("expense", "50000.00")];
    previousMonthTx = [tx("income", "30000.00"), tx("expense", "10000.00")];

    const result = await buildMonthlyHealthCheck();
    expect(result.hasEnoughData).toBe(true);
    expect(result.risks.some((r) => r.type === "cash_flow_negative")).toBe(true);
    expect(result.overallStatus).toBe("needs_attention");
  });

  it("flags an income increase over the threshold as a positive, and always records the raw change", async () => {
    currentMonthTx = [tx("income", "40000.00")];
    previousMonthTx = [tx("income", "30000.00")];

    const result = await buildMonthlyHealthCheck();
    expect(result.positives.find((p) => p.type === "income_up")).toBeTruthy();
    const change = result.changes.find((c) => c.type === "income_change");
    expect(change?.percent).toBeCloseTo(33.33, 1);
  });

  it("flags over-budget status as a risk driving needs_attention, sourced from the deterministic budget tool (not recomputed here)", async () => {
    currentMonthTx = [tx("income", "30000.00"), tx("expense", "29000.00")];
    previousMonthTx = [tx("income", "30000.00"), tx("expense", "20000.00")];
    budgetStatus = { hasBudget: true, status: "over_budget", remainingCents: -50000 };

    const result = await buildMonthlyHealthCheck();
    expect(result.risks.some((r) => r.type === "budget_over" && r.amountCents === -50000)).toBe(true);
    expect(result.overallStatus).toBe("needs_attention");
  });

  it("passes through the deterministic priority action unchanged", async () => {
    currentMonthTx = [tx("income", "30000.00")];
    previousMonthTx = [tx("income", "30000.00")];
    priority = { priorityType: "no_emergency_fund", severity: "high", amountCents: 800000 };

    const result = await buildMonthlyHealthCheck();
    expect(result.priorityAction).toEqual(priority);
  });

  it("counts debt payments made this month as a positive", async () => {
    currentMonthTx = [tx("income", "30000.00"), tx("debt_payment", "2000.00")];
    previousMonthTx = [tx("income", "30000.00")];

    const result = await buildMonthlyHealthCheck();
    expect(result.positives.find((p) => p.type === "debt_paid_down")?.amountCents).toBe(200000);
  });
});
