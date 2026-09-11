/**
 * Wealth Score — 0-100, deterministic, no LLM. Every component score is a
 * pure function of its inputs, documented with the specific assumption it
 * encodes (these are opinionated defaults, not universal financial truths —
 * see each function's comment for the exact mapping).
 *
 * Missing-history fairness rule (required by the task spec): a brand-new
 * user has no prior month/snapshot to compare against. Net Worth Growth and
 * Income Growth return a neutral 50 (not 0) when there's nothing to compare
 * against, alongside a `hasHistory: false` flag, so a new user's overall
 * score isn't dragged down purely for being new.
 */

export const WEALTH_SCORE_WEIGHTS = {
  cashFlow: 0.2,
  savings: 0.15,
  emergencyFund: 0.15,
  debtHealth: 0.15,
  netWorthGrowth: 0.15,
  incomeGrowth: 0.1,
  goalProgress: 0.1,
} as const;

export const WEALTH_SCORE_CALCULATION_VERSION = 1;

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

/** cashFlow/income mapped so breakeven (ratio 0) = 50, fully-saved (ratio 1) = 100, spending double income (ratio -1) = 0. */
export function calculateCashFlowScore(incomeCents: number, cashFlowCents: number): number {
  if (incomeCents <= 0) return cashFlowCents >= 0 ? 50 : 0;
  const ratio = cashFlowCents / incomeCents;
  return clampScore(((ratio + 1) / 2) * 100);
}

/** A 20%+ savings rate is treated as full marks (a common personal-finance rule of thumb), scaled linearly below that. Negative rates clamp to 0. */
export function calculateSavingsScore(savingsRatePercent: number): number {
  return clampScore((savingsRatePercent / 20) * 100);
}

/** monthsProtected / targetMonths (default 6 if the user hasn't set a target). No emergency fund at all is a real, meaningful 0 — not treated as "missing data". */
export function calculateEmergencyFundScore(monthsProtected: number, targetMonths: number = 6): number {
  if (targetMonths <= 0) return 0;
  return clampScore((monthsProtected / targetMonths) * 100);
}

/** Debt-to-income via minimum monthly payments: 0% of income to debt = 100, 50%+ = 0. No liabilities at all scores 100 (nothing dragging on cash flow). */
export function calculateDebtHealthScore(incomeCents: number, minimumPaymentsCents: number): number {
  if (minimumPaymentsCents <= 0) return 100;
  if (incomeCents <= 0) return 0;
  const ratio = minimumPaymentsCents / incomeCents;
  return clampScore(100 - ratio * 200);
}

export interface GrowthScoreResult {
  score: number;
  hasHistory: boolean;
}

/** +50% growth = 100, flat = 50, -50%+ decline = 0. Neutral 50 with hasHistory:false when there's no prior value to compare against (new user fairness rule above). */
function calculateGrowthScore(currentCents: number, previousCents: number | null): GrowthScoreResult {
  if (previousCents === null) return { score: 50, hasHistory: false };
  if (previousCents === 0) {
    return { score: currentCents > 0 ? 100 : 50, hasHistory: true };
  }
  const growthRatio = (currentCents - previousCents) / Math.abs(previousCents);
  return { score: clampScore(50 + growthRatio * 100), hasHistory: true };
}

export function calculateNetWorthGrowthScore(
  currentNetWorthCents: number,
  previousNetWorthCents: number | null
): GrowthScoreResult {
  return calculateGrowthScore(currentNetWorthCents, previousNetWorthCents);
}

export function calculateIncomeGrowthScore(
  currentMonthIncomeCents: number,
  previousMonthIncomeCents: number | null
): GrowthScoreResult {
  return calculateGrowthScore(currentMonthIncomeCents, previousMonthIncomeCents);
}

/** Average progress % across active goals. No active goals is neutral (50), not a penalty — a user isn't required to have goals defined. */
export function calculateGoalProgressScore(activeGoalProgressPercents: number[]): number {
  if (activeGoalProgressPercents.length === 0) return 50;
  const avg = activeGoalProgressPercents.reduce((a, b) => a + b, 0) / activeGoalProgressPercents.length;
  return clampScore(avg);
}

export interface WealthScoreComponents {
  cashFlowScore: number;
  savingsScore: number;
  emergencyFundScore: number;
  debtHealthScore: number;
  netWorthGrowthScore: number;
  incomeGrowthScore: number;
  goalProgressScore: number;
}

export interface WealthScoreResult extends WealthScoreComponents {
  totalScore: number;
  calculationVersion: number;
}

export function calculateWealthScore(components: WealthScoreComponents): WealthScoreResult {
  const totalScore = clampScore(
    components.cashFlowScore * WEALTH_SCORE_WEIGHTS.cashFlow +
      components.savingsScore * WEALTH_SCORE_WEIGHTS.savings +
      components.emergencyFundScore * WEALTH_SCORE_WEIGHTS.emergencyFund +
      components.debtHealthScore * WEALTH_SCORE_WEIGHTS.debtHealth +
      components.netWorthGrowthScore * WEALTH_SCORE_WEIGHTS.netWorthGrowth +
      components.incomeGrowthScore * WEALTH_SCORE_WEIGHTS.incomeGrowth +
      components.goalProgressScore * WEALTH_SCORE_WEIGHTS.goalProgress
  );

  return { ...components, totalScore, calculationVersion: WEALTH_SCORE_CALCULATION_VERSION };
}

// ---------------------------------------------------------------------------
// Improvement actions — measurable, never generic ("increase X by ฿Y", not
// "spend less"). Returned as structured data (not pre-translated strings) so
// the UI composes the sentence from i18n dictionary fragments + formatted
// numbers, same pattern as the rest of the app.
// ---------------------------------------------------------------------------

export type WealthScoreActionType =
  | "increase_emergency_fund"
  | "reduce_discretionary_spending"
  | "improve_savings_rate"
  | "contribute_to_goal"
  | "reduce_debt_payments";

export interface WealthScoreAction {
  type: WealthScoreActionType;
  /** Cents amount relevant to the action (e.g. how much more to save), when applicable. */
  amountCents?: number;
  /** Target percent relevant to the action (e.g. target savings rate), when applicable. */
  targetPercent?: number;
  goalName?: string;
  priority: number; // lower = higher priority (surfaced first)
}

export interface WealthScoreActionContext {
  components: WealthScoreComponents;
  essentialMonthlyExpensesCents: number;
  emergencyFundCurrentCents: number;
  emergencyFundTargetMonths: number;
  incomeCents: number;
  cashFlowCents: number;
  savingsRatePercent: number;
  minimumDebtPaymentsCents: number;
  goals: { name: string; progressPercent: number; requiredMonthlyContributionCents: number | null }[];
}

const ACTION_SCORE_THRESHOLD = 90;

/** Returns concrete, measurable actions for whichever components are below a "good" threshold — never generic advice. */
export function getWealthScoreImprovementActions(ctx: WealthScoreActionContext): WealthScoreAction[] {
  const actions: WealthScoreAction[] = [];

  if (ctx.components.emergencyFundScore < ACTION_SCORE_THRESHOLD) {
    const targetCents = ctx.essentialMonthlyExpensesCents * ctx.emergencyFundTargetMonths;
    const gapCents = Math.max(0, targetCents - ctx.emergencyFundCurrentCents);
    if (gapCents > 0) {
      actions.push({ type: "increase_emergency_fund", amountCents: gapCents, priority: 1 });
    }
  }

  if (ctx.components.debtHealthScore < ACTION_SCORE_THRESHOLD && ctx.minimumDebtPaymentsCents > 0) {
    actions.push({ type: "reduce_debt_payments", amountCents: ctx.minimumDebtPaymentsCents, priority: 2 });
  }

  if (ctx.components.savingsScore < ACTION_SCORE_THRESHOLD) {
    actions.push({ type: "improve_savings_rate", targetPercent: 20, priority: 3 });
  }

  if (ctx.components.cashFlowScore < ACTION_SCORE_THRESHOLD && ctx.cashFlowCents < 0) {
    actions.push({
      type: "reduce_discretionary_spending",
      amountCents: Math.abs(ctx.cashFlowCents),
      priority: 4,
    });
  }

  const behindGoal = ctx.goals
    .filter((g) => g.progressPercent < 100 && g.requiredMonthlyContributionCents !== null)
    .sort((a, b) => a.progressPercent - b.progressPercent)[0];
  if (behindGoal && ctx.components.goalProgressScore < ACTION_SCORE_THRESHOLD) {
    actions.push({
      type: "contribute_to_goal",
      amountCents: behindGoal.requiredMonthlyContributionCents ?? undefined,
      goalName: behindGoal.name,
      priority: 5,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}
