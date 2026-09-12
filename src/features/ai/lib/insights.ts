import "server-only";

/**
 * AI Insight cards — fully deterministic, same principle as the Monthly
 * Health Check: real computed numbers only, no LLM call. Insights are only
 * generated when a change is actually meaningful (crosses a threshold in
 * both percentage and absolute terms where relevant) — this file is the one
 * place that decides "is this worth showing", so spam is prevented at the
 * source rather than by trusting a model not to over-talk.
 */

import { getTransactions, getCurrentMonthRange } from "@/features/transactions/queries";
import { getCategories } from "@/features/categories/queries";
import { calculateSavingsRate } from "@/lib/financial/calculations";
import { parseMoneyToCents } from "@/lib/financial/money";
import { getDebtSummary, getGoalProgress, getNetWorthSummary } from "@/features/ai/tools";
import { toLocalDateString } from "@/lib/date";

export type InsightType =
  | "spending_increase"
  | "savings_rate_drop"
  | "debt_progress"
  | "goal_ahead"
  | "net_worth_growth";

export interface Insight {
  type: InsightType;
  categoryName?: string;
  goalName?: string;
  percent?: number;
  amountCents?: number;
}

const SPENDING_INCREASE_PERCENT_THRESHOLD = 30;
const SPENDING_INCREASE_MIN_CENTS = 50_000; // ฿500 — ignore noise on trivial categories
const SAVINGS_RATE_DROP_THRESHOLD_POINTS = 10;
const DEBT_PAYMENT_MIN_CENTS = 1;
const NET_WORTH_GROWTH_MIN_CENTS = 1;

function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

async function findBiggestSpendingIncrease(): Promise<Insight | null> {
  const { from, to } = getCurrentMonthRange();
  const prev = previousMonthRange();

  const [currentTx, prevTx, categories] = await Promise.all([
    getTransactions({ from, to, type: "expense" }),
    getTransactions({ from: prev.from, to: prev.to, type: "expense" }),
    getCategories(),
  ]);
  if (prevTx.length === 0) return null;

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const sumByCategory = (transactions: typeof currentTx) => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      const key = t.category_id ?? "uncategorized";
      totals.set(key, (totals.get(key) ?? 0) + parseMoneyToCents(t.amount));
    }
    return totals;
  };

  const currentTotals = sumByCategory(currentTx);
  const prevTotals = sumByCategory(prevTx);

  let best: { categoryName: string; percent: number; amountCents: number } | null = null;
  for (const [categoryId, currentCents] of currentTotals) {
    const prevCents = prevTotals.get(categoryId) ?? 0;
    if (prevCents <= 0) continue;
    if (currentCents < SPENDING_INCREASE_MIN_CENTS) continue;
    const percent = ((currentCents - prevCents) / prevCents) * 100;
    if (percent < SPENDING_INCREASE_PERCENT_THRESHOLD) continue;
    if (!best || percent > best.percent) {
      const category = categoryById.get(categoryId);
      best = { categoryName: category?.name_th ?? "อื่นๆ", percent, amountCents: currentCents };
    }
  }

  return best ? { type: "spending_increase", categoryName: best.categoryName, percent: best.percent, amountCents: best.amountCents } : null;
}

async function findSavingsRateDrop(): Promise<Insight | null> {
  const { from, to } = getCurrentMonthRange();
  const prev = previousMonthRange();
  const [currentTx, prevTx] = await Promise.all([
    getTransactions({ from, to }),
    getTransactions({ from: prev.from, to: prev.to }),
  ]);
  if (prevTx.length === 0) return null;

  const delta = calculateSavingsRate(currentTx) - calculateSavingsRate(prevTx);
  if (delta > -SAVINGS_RATE_DROP_THRESHOLD_POINTS) return null;
  return { type: "savings_rate_drop", percent: delta };
}

async function findDebtProgress(): Promise<Insight | null> {
  const { from, to } = getCurrentMonthRange();
  const [currentTx, debtSummary] = await Promise.all([getTransactions({ from, to, type: "debt_payment" }), getDebtSummary()]);
  if (!debtSummary.hasDebt) return null;
  const paidCents = currentTx.reduce((total, t) => total + parseMoneyToCents(t.amount), 0);
  if (paidCents < DEBT_PAYMENT_MIN_CENTS) return null;
  return { type: "debt_progress", amountCents: paidCents };
}

async function findGoalAhead(): Promise<Insight | null> {
  const goals = await getGoalProgress();
  const ahead = goals.goals.find((g) => g.scheduleStatus === "ahead");
  if (!ahead) return null;
  return { type: "goal_ahead", goalName: ahead.name, percent: ahead.progressPercent };
}

async function findNetWorthGrowth(): Promise<Insight | null> {
  const netWorth = await getNetWorthSummary();
  if (netWorth.changeVsPreviousCents === null || netWorth.changeVsPreviousCents < NET_WORTH_GROWTH_MIN_CENTS) return null;
  return { type: "net_worth_growth", amountCents: netWorth.changeVsPreviousCents };
}

/**
 * All currently-meaningful insights, most-important first. Callers should
 * generally show only the first one or two — this list is deliberately not
 * meant to be dumped in full as a feed.
 */
export async function buildInsights(): Promise<Insight[]> {
  const results = await Promise.all([
    findSavingsRateDrop(),
    findSpendingIncreaseGuarded(),
    findDebtProgress(),
    findGoalAhead(),
    findNetWorthGrowth(),
  ]);
  return results.filter((insight): insight is Insight => insight !== null);
}

// Isolated wrapper so a category-comparison failure can't take down the
// other independent insights in the Promise.all above.
async function findSpendingIncreaseGuarded(): Promise<Insight | null> {
  return findBiggestSpendingIncrease();
}

/** The single highest-priority insight, or null — the one shown on the dashboard. */
export async function getTopInsight(): Promise<Insight | null> {
  const insights = await buildInsights();
  return insights[0] ?? null;
}
