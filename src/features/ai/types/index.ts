/**
 * Shared types for the AI Money Coach feature. Every "tool" and the
 * Financial Context Builder return these — plain, JSON-serializable,
 * already-formatted-for-display data. Never raw DB rows, never internal
 * UUIDs unless a value is genuinely needed for a follow-up action.
 */

export type Locale = "th" | "en";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface FinancialSnapshotTool {
  currencyCode: string;
  monthLabel: string;
  incomeCents: number;
  expensesCents: number;
  cashFlowCents: number;
  savingsRatePercent: number;
  hasAnyData: boolean;
}

export interface CashFlowTool {
  currentMonthCashFlowCents: number;
  previousMonthCashFlowCents: number | null;
}

export interface BudgetStatusTool {
  hasBudget: boolean;
  totalBudgetCents?: number;
  spentCents?: number;
  remainingCents?: number;
  percentUsed?: number;
  status?: "no_budget" | "healthy" | "near_limit" | "over_budget";
  overBudgetCategories?: { name: string; spentCents: number; budgetCents: number }[];
}

export interface NetWorthTool {
  netWorthCents: number;
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  changeVsPreviousCents: number | null;
}

export interface GoalProgressTool {
  goals: {
    name: string;
    type: string;
    progressPercent: number;
    remainingCents: number;
    requiredMonthlyContributionCents: number | null;
    scheduleStatus: "achieved" | "ahead" | "on_track" | "behind" | "unknown";
  }[];
}

export interface EmergencyFundTool {
  isSetUp: boolean;
  currentAmountCents?: number;
  targetAmountCents?: number;
  monthsProtected?: number;
  targetMonths?: number;
}

export interface SafeToSpendTool {
  hasCompleteData: boolean;
  todayCents?: number;
  thisWeekCents?: number;
  thisMonthCents?: number;
}

export interface WealthScoreTool {
  totalScore: number;
  components: {
    cashFlow: number;
    savings: number;
    emergencyFund: number;
    debtHealth: number;
    netWorthGrowth: number;
    incomeGrowth: number;
    goalProgress: number;
  };
}

export interface DebtSummaryTool {
  hasDebt: boolean;
  totalDebtCents?: number;
  liabilities?: { name: string; balanceCents: number; interestRatePercent: number | null }[];
}

export interface DebtPlanTool {
  hasPlan: boolean;
  strategy?: string;
  monthsToDebtFree?: number | null;
  totalInterestPaidCents?: number;
  interestSavedCents?: number;
}

export interface ForecastSummaryTool {
  hasScenario: boolean;
  scenarioName?: string;
  horizonMonths?: number;
  projectedNetWorthCents?: number;
}

export interface MoneyYearProgressTool {
  hasPlan: boolean;
  year?: number;
  metrics?: { key: string; actualCents: number; targetCents: number; status: "ahead" | "on_track" | "behind" }[];
}

export interface LifeStageTool {
  stage: string;
  nextStage: string | null;
}

export interface PriorityTool {
  priorityType: string;
  severity: string;
  amountCents?: number;
  targetPercent?: number;
  goalName?: string;
  /** For `high_interest_debt`, the liability's annual interest rate percent. Not a currency amount — never confuse with amountCents. */
  targetValue?: number;
}

export interface RecentTransactionsSummaryTool {
  count: number;
  topCategories: { name: string; totalCents: number }[];
}

export interface IncomeSummaryTool {
  currentMonthIncomeCents: number;
  previousMonthIncomeCents: number | null;
  growthPercent: number | null;
}

/** Day 5 Income Engine tools — kept compact per the task's "do not send the full opportunity catalog on every chat turn" rule. */
export interface IncomeProfileTool {
  currentMonthlyIncomeCents: number;
  averageMonthlyIncomeCents: number;
  stableIncomeCents: number;
  variableIncomeCents: number;
  activeSourceCount: number;
  primarySource: string | null;
  concentrationPercent: number | null;
  momGrowthPercent: number | null;
  stability: "stable" | "mixed" | "variable" | "unknown";
}

export interface IncomeGapTool {
  hasTarget: boolean;
  targetMonthlyIncomeCents: number | null;
  gapCents: number | null;
  achieved: boolean;
}

/** Category counts only — never every skill's full notes/experience detail. */
export interface SkillProfileTool {
  totalSkills: number;
  topCategories: string[];
}

/** Top 3 at most — never the full ~17-row catalog. */
export interface TopIncomeOpportunityTool {
  name: string;
  score: number;
  matchedSkillCategories: string[];
  missingRequirements: string[];
}

/** A short status list — never the full mission template catalog. */
export interface ActiveIncomeMissionTool {
  missionType: string;
  status: "not_started" | "in_progress" | "completed" | "skipped";
}

/** Day 6 Engagement tools — same "compact summary, never the full list" rule as Day 5's. */
export interface ActiveWealthMissionTool {
  templateKey: string;
  status: "not_started" | "in_progress" | "completed" | "skipped";
  impactLevel: "low" | "medium" | "high";
}

export interface UpcomingBillsTool {
  overdueCount: number;
  next7DaysCount: number;
  totalDueCents: number;
  nextItem: { label: string; amountCents: number; dueDate: string } | null;
}

export interface DetectedSubscriptionsTool {
  pendingCount: number;
  topCandidate: { merchant: string; estimatedAmountCents: number; frequency: string } | null;
}

export interface MonthlyReviewStatusTool {
  completedThisMonth: boolean;
  lastCompletedYearMonth: string | null;
}

export interface UserProgressTool {
  level: number;
  totalXp: number;
  weeklyStreak: number;
  monthlyReviewStreak: number;
  trackingDaysStreak: number;
}

/**
 * The compact snapshot sent with every chat turn. Deliberately NOT the
 * user's raw transaction history — every field here is already a summary.
 */
export interface FinancialContext {
  locale: Locale;
  currencyCode: string;
  snapshot: FinancialSnapshotTool;
  cashFlow: CashFlowTool;
  safeToSpend: SafeToSpendTool;
  budget: BudgetStatusTool;
  netWorth: NetWorthTool;
  emergencyFund: EmergencyFundTool;
  debts: DebtSummaryTool;
  goals: GoalProgressTool;
  wealthScore: WealthScoreTool | null;
  lifeStage: LifeStageTool;
  currentPriority: PriorityTool | null;
  recentSpending: RecentTransactionsSummaryTool;
  income: IncomeSummaryTool;
  incomeProfile: IncomeProfileTool;
  incomeGap: IncomeGapTool;
  skills: SkillProfileTool;
  topOpportunities: TopIncomeOpportunityTool[];
  activeMissions: ActiveIncomeMissionTool[];
  activeWealthMissions: ActiveWealthMissionTool[];
  upcomingBills: UpcomingBillsTool;
  detectedSubscriptions: DetectedSubscriptionsTool;
  monthlyReviewStatus: MonthlyReviewStatusTool;
  userProgress: UserProgressTool;
}
