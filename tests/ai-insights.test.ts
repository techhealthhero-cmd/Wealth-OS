import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildInsights, getTopInsight, getVisibleInsights } from "@/features/ai/lib/insights";
import type { DebtSummaryTool, GoalProgressTool, NetWorthTool } from "@/features/ai/types";

let mockCanUseAdvancedInsights = false;
vi.mock("@/lib/billing/entitlements", () => ({
  FEATURES: { ADVANCED_INSIGHTS: "ADVANCED_INSIGHTS" },
  canUseFeature: vi.fn(async () => mockCanUseAdvancedInsights),
}));

interface FakeTx {
  type: "income" | "expense" | "debt_payment";
  amount: string;
  category_id?: string | null;
}

let currentAll: FakeTx[] = [];
let previousAll: FakeTx[] = [];
let currentExpense: FakeTx[] = [];
let previousExpense: FakeTx[] = [];
let currentDebtPayment: FakeTx[] = [];
let debtSummary: DebtSummaryTool = { hasDebt: false };
let goalProgress: GoalProgressTool = { goals: [] };
let netWorth: NetWorthTool = { netWorthCents: 0, totalAssetsCents: 0, totalLiabilitiesCents: 0, changeVsPreviousCents: null };

vi.mock("@/features/transactions/queries", () => ({
  getCurrentMonthRange: vi.fn(() => ({ from: "2026-09-01", to: "2026-09-30" })),
  getTransactions: vi.fn(async (filters: { from: string; type?: string }) => {
    const isCurrent = filters.from === "2026-09-01";
    if (filters.type === "expense") return isCurrent ? currentExpense : previousExpense;
    if (filters.type === "debt_payment") return isCurrent ? currentDebtPayment : [];
    return isCurrent ? currentAll : previousAll;
  }),
}));

vi.mock("@/features/categories/queries", () => ({
  getCategories: vi.fn(async () => [
    { id: "cat-shopping", name_th: "ช้อปปิ้ง", name_en: "Shopping" },
    { id: "cat-food", name_th: "อาหาร", name_en: "Food" },
  ]),
}));

vi.mock("@/features/ai/tools", () => ({
  getDebtSummary: vi.fn(async () => debtSummary),
  getGoalProgress: vi.fn(async () => goalProgress),
  getNetWorthSummary: vi.fn(async () => netWorth),
}));

function tx(type: FakeTx["type"], amount: string, categoryId?: string): FakeTx {
  return { type, amount, category_id: categoryId };
}

describe("buildInsights — meaningful-change thresholds", () => {
  beforeEach(() => {
    currentAll = [];
    previousAll = [];
    currentExpense = [];
    previousExpense = [];
    currentDebtPayment = [];
    debtSummary = { hasDebt: false };
    goalProgress = { goals: [] };
    netWorth = { netWorthCents: 0, totalAssetsCents: 0, totalLiabilitiesCents: 0, changeVsPreviousCents: null };
  });

  it("returns no insights when nothing meaningful changed", async () => {
    currentAll = [tx("income", "30000.00"), tx("expense", "20000.00")];
    previousAll = [tx("income", "30000.00"), tx("expense", "20000.00")];

    const insights = await buildInsights();
    expect(insights).toEqual([]);
  });

  it("flags a category spending increase only once it crosses both the percent and absolute-amount thresholds", async () => {
    previousExpense = [tx("expense", "1000.00", "cat-shopping")];
    currentExpense = [tx("expense", "1500.00", "cat-shopping")]; // +50%, but only ฿1,500 total — below the ฿500 min is fine here since 1500 >= 500
    currentAll = currentExpense;
    previousAll = previousExpense;

    const insights = await buildInsights();
    const spending = insights.find((i) => i.type === "spending_increase");
    expect(spending?.categoryName).toBe("ช้อปปิ้ง");
    expect(spending?.percent).toBeCloseTo(50, 0);
  });

  it("does not flag a spending increase below the percent threshold", async () => {
    previousExpense = [tx("expense", "1000.00", "cat-shopping")];
    currentExpense = [tx("expense", "1100.00", "cat-shopping")]; // only +10%
    currentAll = currentExpense;
    previousAll = previousExpense;

    const insights = await buildInsights();
    expect(insights.find((i) => i.type === "spending_increase")).toBeUndefined();
  });

  it("flags a savings rate drop over the threshold", async () => {
    currentAll = [tx("income", "30000.00"), tx("expense", "27000.00")]; // 10% savings rate
    previousAll = [tx("income", "30000.00"), tx("expense", "15000.00")]; // 50% savings rate

    const insights = await buildInsights();
    const drop = insights.find((i) => i.type === "savings_rate_drop");
    expect(drop).toBeTruthy();
    expect(drop!.percent).toBeLessThan(0);
  });

  it("flags debt progress only when the user actually has debt", async () => {
    currentAll = [tx("income", "30000.00")];
    previousAll = [tx("income", "30000.00")];
    currentDebtPayment = [tx("debt_payment", "1500.00")];
    debtSummary = { hasDebt: true, totalDebtCents: 500000 };

    const insights = await buildInsights();
    expect(insights.find((i) => i.type === "debt_progress")?.amountCents).toBe(150000);
  });

  it("does not flag debt progress when the user has no debt, even if a stray payment transaction exists", async () => {
    currentAll = [tx("income", "30000.00")];
    previousAll = [tx("income", "30000.00")];
    currentDebtPayment = [tx("debt_payment", "1500.00")];
    debtSummary = { hasDebt: false };

    const insights = await buildInsights();
    expect(insights.find((i) => i.type === "debt_progress")).toBeUndefined();
  });

  it("flags a goal that is ahead of schedule, by name", async () => {
    currentAll = [tx("income", "30000.00")];
    previousAll = [tx("income", "30000.00")];
    goalProgress = {
      goals: [
        { name: "Trip", type: "custom", progressPercent: 80, remainingCents: 10000, requiredMonthlyContributionCents: null, scheduleStatus: "on_track" },
        { name: "House", type: "custom", progressPercent: 90, remainingCents: 5000, requiredMonthlyContributionCents: null, scheduleStatus: "ahead" },
      ],
    };

    const insights = await buildInsights();
    expect(insights.find((i) => i.type === "goal_ahead")?.goalName).toBe("House");
  });

  it("flags net worth growth only when it actually increased", async () => {
    currentAll = [tx("income", "30000.00")];
    previousAll = [tx("income", "30000.00")];
    netWorth = { netWorthCents: 110000, totalAssetsCents: 210000, totalLiabilitiesCents: 100000, changeVsPreviousCents: 10000 };

    const insights = await buildInsights();
    expect(insights.find((i) => i.type === "net_worth_growth")?.amountCents).toBe(10000);
  });
});

describe("getTopInsight", () => {
  beforeEach(() => {
    currentAll = [];
    previousAll = [];
    currentExpense = [];
    previousExpense = [];
    currentDebtPayment = [];
    debtSummary = { hasDebt: false };
    goalProgress = { goals: [] };
    netWorth = { netWorthCents: 0, totalAssetsCents: 0, totalLiabilitiesCents: 0, changeVsPreviousCents: null };
  });

  it("returns null when there is nothing meaningful to show — avoids spam rather than forcing a filler insight", async () => {
    currentAll = [tx("income", "30000.00")];
    previousAll = [tx("income", "30000.00")];
    expect(await getTopInsight()).toBeNull();
  });

  it("returns the first meaningful insight when one exists", async () => {
    currentAll = [tx("income", "30000.00")];
    previousAll = [tx("income", "30000.00")];
    netWorth = { netWorthCents: 110000, totalAssetsCents: 210000, totalLiabilitiesCents: 100000, changeVsPreviousCents: 10000 };
    expect((await getTopInsight())?.type).toBe("net_worth_growth");
  });
});

describe("getVisibleInsights — plan-aware (Pro-exclusive ADVANCED_INSIGHTS)", () => {
  beforeEach(() => {
    currentAll = [tx("income", "30000.00"), tx("expense", "27000.00")]; // savings rate drop
    previousAll = [tx("income", "30000.00"), tx("expense", "15000.00")];
    currentDebtPayment = [tx("debt_payment", "1500.00")];
    debtSummary = { hasDebt: true, totalDebtCents: 500000 }; // + debt progress = 2 insights total
    goalProgress = { goals: [] };
    netWorth = { netWorthCents: 0, totalAssetsCents: 0, totalLiabilitiesCents: 0, changeVsPreviousCents: null };
    currentExpense = [];
    previousExpense = [];
  });

  it("Free/Plus (no ADVANCED_INSIGHTS entitlement) see only the single top insight, same as getTopInsight()", async () => {
    mockCanUseAdvancedInsights = false;
    const all = await buildInsights();
    expect(all.length).toBeGreaterThan(1); // sanity: more than one insight is actually available to be hidden

    const visible = await getVisibleInsights();
    expect(visible).toHaveLength(1);
    expect(visible[0]).toEqual(all[0]);
  });

  it("Pro (has ADVANCED_INSIGHTS entitlement) sees every currently-meaningful insight", async () => {
    mockCanUseAdvancedInsights = true;
    const all = await buildInsights();
    const visible = await getVisibleInsights();
    expect(visible).toEqual(all);
    expect(visible.length).toBeGreaterThan(1);
  });

  it("returns an empty array (not null/undefined) when nothing meaningful changed, regardless of plan", async () => {
    currentAll = [tx("income", "30000.00")];
    previousAll = [tx("income", "30000.00")];
    currentDebtPayment = [];
    debtSummary = { hasDebt: false };

    mockCanUseAdvancedInsights = true;
    expect(await getVisibleInsights()).toEqual([]);
  });
});
