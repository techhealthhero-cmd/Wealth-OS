import { describe, expect, it, vi } from "vitest";

import { buildFinancialContext } from "@/features/ai/lib/context-builder";
import type {
  BudgetStatusTool,
  DebtSummaryTool,
  EmergencyFundTool,
  FinancialSnapshotTool,
  GoalProgressTool,
  IncomeSummaryTool,
  LifeStageTool,
  NetWorthTool,
  PriorityTool,
  RecentTransactionsSummaryTool,
  SafeToSpendTool,
  WealthScoreTool,
} from "@/features/ai/types";

const snapshot: FinancialSnapshotTool = {
  currencyCode: "THB",
  monthLabel: "2026-09",
  incomeCents: 3500000,
  expensesCents: 2800000,
  cashFlowCents: 700000,
  savingsRatePercent: 20,
  hasAnyData: true,
};
const cashFlow = { currentMonthCashFlowCents: 700000, previousMonthCashFlowCents: 600000 };
const safeToSpend: SafeToSpendTool = { hasCompleteData: true, todayCents: 10000 };
const budget: BudgetStatusTool = { hasBudget: false };
const netWorth: NetWorthTool = { netWorthCents: 100000, totalAssetsCents: 200000, totalLiabilitiesCents: 100000, changeVsPreviousCents: null };
const emergencyFund: EmergencyFundTool = { isSetUp: false };
const debts: DebtSummaryTool = { hasDebt: false };
const goals: GoalProgressTool = { goals: [] };
const wealthScore: WealthScoreTool = { totalScore: 65, components: { cashFlow: 10, savings: 10, emergencyFund: 10, debtHealth: 10, netWorthGrowth: 10, incomeGrowth: 10, goalProgress: 5 } };
const lifeStage: LifeStageTool = { stage: "building_stability", nextStage: "growing_wealth" };
const currentPriority: PriorityTool = { priorityType: "no_emergency_fund", severity: "high", amountCents: 800000 };
const recentSpending: RecentTransactionsSummaryTool = { count: 12, topCategories: [{ name: "Food", totalCents: 500000 }] };
const income: IncomeSummaryTool = { currentMonthIncomeCents: 3500000, previousMonthIncomeCents: 3400000, growthPercent: 2.9 };

vi.mock("@/features/ai/tools", () => ({
  getFinancialSummary: vi.fn(async () => snapshot),
  getMonthlyCashFlow: vi.fn(async () => cashFlow),
  getSafeToSpendSummary: vi.fn(async () => safeToSpend),
  getBudgetStatus: vi.fn(async () => budget),
  getNetWorthSummary: vi.fn(async () => netWorth),
  getEmergencyFundStatus: vi.fn(async () => emergencyFund),
  getDebtSummary: vi.fn(async () => debts),
  getGoalProgress: vi.fn(async () => goals),
  getWealthScoreSummary: vi.fn(async () => wealthScore),
  getFinancialLifeStage: vi.fn(async () => lifeStage),
  getFinancialPriority: vi.fn(async () => currentPriority),
  getRecentTransactionsSummary: vi.fn(async () => recentSpending),
  getIncomeSummary: vi.fn(async () => income),
}));

vi.mock("@/features/profile/queries", () => ({
  getProfile: vi.fn(async () => ({ currency_code: "THB", preferred_language: "en" })),
}));

vi.mock("@/i18n/server", () => ({
  getLocale: vi.fn(async (preferred?: string | null) => preferred ?? "th"),
}));

describe("buildFinancialContext — Financial Context Builder", () => {
  it("composes all tool outputs into one FinancialContext, keyed correctly", async () => {
    const context = await buildFinancialContext();

    expect(context.locale).toBe("en");
    expect(context.currencyCode).toBe("THB");
    expect(context.snapshot).toEqual(snapshot);
    expect(context.cashFlow).toEqual(cashFlow);
    expect(context.safeToSpend).toEqual(safeToSpend);
    expect(context.budget).toEqual(budget);
    expect(context.netWorth).toEqual(netWorth);
    expect(context.emergencyFund).toEqual(emergencyFund);
    expect(context.debts).toEqual(debts);
    expect(context.goals).toEqual(goals);
    expect(context.wealthScore).toEqual(wealthScore);
    expect(context.lifeStage).toEqual(lifeStage);
    expect(context.currentPriority).toEqual(currentPriority);
    expect(context.recentSpending).toEqual(recentSpending);
    expect(context.income).toEqual(income);
  });

  it("does not include full transaction history — only the pre-computed summaries", async () => {
    const context = await buildFinancialContext();
    // The compact context should never carry a raw transactions array —
    // only summaries (counts, top categories) computed by the tools layer.
    expect(context).not.toHaveProperty("transactions");
    expect(Array.isArray((context as unknown as { recentSpending: { topCategories: unknown } }).recentSpending.topCategories)).toBe(true);
  });

  it("falls back to THB when the profile has no currency set", async () => {
    const profileModule = await import("@/features/profile/queries");
    vi.mocked(profileModule.getProfile).mockResolvedValueOnce({ currency_code: null, preferred_language: null } as never);
    const context = await buildFinancialContext();
    expect(context.currencyCode).toBe("THB");
  });
});
