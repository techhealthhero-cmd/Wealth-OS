import { describe, expect, it, vi } from "vitest";

import { buildFinancialContext } from "@/features/ai/lib/context-builder";
import type {
  ActiveIncomeMissionTool,
  ActiveWealthMissionTool,
  BudgetStatusTool,
  DebtSummaryTool,
  DetectedSubscriptionsTool,
  EmergencyFundTool,
  FinancialSnapshotTool,
  GoalProgressTool,
  IncomeGapTool,
  IncomeProfileTool,
  IncomeSummaryTool,
  LifeStageTool,
  MonthlyReviewStatusTool,
  NetWorthTool,
  PriorityTool,
  RecentTransactionsSummaryTool,
  SafeToSpendTool,
  SkillProfileTool,
  TopIncomeOpportunityTool,
  UpcomingBillsTool,
  UserProgressTool,
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
const incomeProfile: IncomeProfileTool = {
  currentMonthlyIncomeCents: 3500000,
  averageMonthlyIncomeCents: 3450000,
  stableIncomeCents: 3000000,
  variableIncomeCents: 450000,
  activeSourceCount: 2,
  primarySource: "Salary",
  concentrationPercent: 87,
  momGrowthPercent: 1.4,
  stability: "mixed",
};
const incomeGap: IncomeGapTool = { hasTarget: true, targetMonthlyIncomeCents: 5000000, gapCents: 1550000, achieved: false };
const skills: SkillProfileTool = { totalSkills: 3, topCategories: ["web_development", "design"] };
const topOpportunities: TopIncomeOpportunityTool[] = [
  { name: "Freelance web development", score: 78, matchedSkillCategories: ["web_development"], missingRequirements: [] },
];
const activeMissions: ActiveIncomeMissionTool[] = [{ missionType: "define_offer", status: "in_progress" }];
const activeWealthMissions: ActiveWealthMissionTool[] = [{ templateKey: "create_first_budget", status: "not_started", impactLevel: "high" }];
const upcomingBills: UpcomingBillsTool = {
  overdueCount: 0,
  next7DaysCount: 1,
  totalDueCents: 50000,
  nextItem: { label: "Internet", amountCents: 50000, dueDate: "2026-09-20" },
};
const detectedSubscriptions: DetectedSubscriptionsTool = {
  pendingCount: 1,
  topCandidate: { merchant: "Netflix", estimatedAmountCents: 35000, frequency: "monthly" },
};
const monthlyReviewStatus: MonthlyReviewStatusTool = { completedThisMonth: false, lastCompletedYearMonth: "2026-08" };
const userProgress: UserProgressTool = { level: 2, totalXp: 120, weeklyStreak: 3, monthlyReviewStreak: 1, trackingDaysStreak: 5 };

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
  getIncomeProfile: vi.fn(async () => incomeProfile),
  getIncomeGap: vi.fn(async () => incomeGap),
  getSkillProfile: vi.fn(async () => skills),
  getTopIncomeOpportunities: vi.fn(async () => topOpportunities),
  getActiveIncomeMissions: vi.fn(async () => activeMissions),
  getActiveWealthMissionsTool: vi.fn(async () => activeWealthMissions),
  getUpcomingBillsTool: vi.fn(async () => upcomingBills),
  getDetectedSubscriptionsTool: vi.fn(async () => detectedSubscriptions),
  getMonthlyReviewStatusTool: vi.fn(async () => monthlyReviewStatus),
  getUserProgressTool: vi.fn(async () => userProgress),
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
    expect(context.incomeProfile).toEqual(incomeProfile);
    expect(context.incomeGap).toEqual(incomeGap);
    expect(context.skills).toEqual(skills);
    expect(context.topOpportunities).toEqual(topOpportunities);
    expect(context.activeMissions).toEqual(activeMissions);
    expect(context.activeWealthMissions).toEqual(activeWealthMissions);
    expect(context.upcomingBills).toEqual(upcomingBills);
    expect(context.detectedSubscriptions).toEqual(detectedSubscriptions);
    expect(context.monthlyReviewStatus).toEqual(monthlyReviewStatus);
    expect(context.userProgress).toEqual(userProgress);
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
