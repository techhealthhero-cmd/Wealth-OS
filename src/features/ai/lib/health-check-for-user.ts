import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { computeMonthlyHealthCheck, type HealthCheckInputs, type MonthlyHealthCheck } from "@/features/ai/lib/health-check";
import { calculateExpenses } from "@/lib/financial/calculations";
import { calculateBudgetStatus, daysInMonth } from "@/lib/financial/budget";
import { calculateNetWorth } from "@/lib/financial/net-worth";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import type { BudgetStatusTool, NetWorthTool } from "@/features/ai/types";
import type { TransactionWithRelations } from "@/features/transactions/queries";

type AdminClient = ReturnType<typeof createAdminClient>;

function monthRange(monthsAgo: number): { from: string; to: string; date: Date } {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const from = toLocalDateString(date);
  const to = toLocalDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  return { from, to, date };
}

/**
 * Minimal userId-scoped stand-in for getTransactions() — that function (and
 * everything else in features/*\/queries.ts) reads the CURRENT session's
 * user via cookie-based createClient(), which a cron job has no session to
 * provide. RLS is bypassed with the admin client, so `.eq("user_id", ...)`
 * here is load-bearing, not optional. Only the columns
 * computeMonthlyHealthCheck()'s calculation functions actually read.
 */
async function getTransactionsForUser(
  admin: AdminClient,
  userId: string,
  from: string,
  to: string
): Promise<TransactionWithRelations[]> {
  const { data, error } = await admin
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", from)
    .lte("transaction_date", to);
  if (error) throw new Error(`Failed to load transactions for cron check-in: ${error.message}`);
  return (data ?? []) as unknown as TransactionWithRelations[];
}

/**
 * computeMonthlyHealthCheck() only ever reads `hasBudget`/`status` off this
 * (never `overBudgetCategories`) — so this deliberately skips fetching
 * budget_categories/per-category breakdown, unlike the full interactive
 * getBudgetStatus(). Reuses the exact same pure calculateBudgetStatus() the
 * real one does, just fed from an admin-client fetch instead of a session
 * one.
 */
async function getBudgetStatusForUser(
  admin: AdminClient,
  userId: string,
  currentTx: TransactionWithRelations[]
): Promise<BudgetStatusTool> {
  const now = new Date();
  const monthKey = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));

  const { data: budget, error } = await admin
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("month", monthKey)
    .maybeSingle();
  if (error) throw new Error(`Failed to load budget for cron check-in: ${error.message}`);
  if (!budget) return { hasBudget: false };

  const spentCents = calculateExpenses(currentTx);
  const totalDays = daysInMonth(now.getFullYear(), now.getMonth());
  const overall = calculateBudgetStatus(parseMoneyToCents(budget.total_budget), spentCents, now.getDate(), totalDays);

  return {
    hasBudget: true,
    totalBudgetCents: parseMoneyToCents(budget.total_budget),
    spentCents: overall.spentCents,
    remainingCents: overall.remainingCents,
    percentUsed: overall.percentUsed,
    status: overall.status,
  };
}

/** UserId-scoped stand-in for getNetWorthSummary() — same calculateNetWorth() pure function, admin-client fetch instead of getAccounts()/getAssets()/getLiabilities()'s session-scoped ones. */
async function getNetWorthSummaryForUser(admin: AdminClient, userId: string): Promise<NetWorthTool> {
  const [accountsRes, assetsRes, liabilitiesRes, snapshotsRes] = await Promise.all([
    admin.from("accounts").select("*").eq("user_id", userId),
    admin.from("assets").select("*").eq("user_id", userId),
    admin.from("liabilities").select("*").eq("user_id", userId),
    admin.from("net_worth_snapshots").select("*").eq("user_id", userId).order("snapshot_date", { ascending: false }).limit(2),
  ]);
  for (const res of [accountsRes, assetsRes, liabilitiesRes, snapshotsRes]) {
    if (res.error) throw new Error(`Failed to load net worth data for cron check-in: ${res.error.message}`);
  }

  const accounts = accountsRes.data ?? [];
  const assets = assetsRes.data ?? [];
  const liabilities = liabilitiesRes.data ?? [];
  const snapshots = (snapshotsRes.data ?? []).reverse();

  const breakdown = calculateNetWorth(
    accounts.map((a) => ({ balanceCents: parseMoneyToCents(a.current_balance), includeInNetWorth: a.include_in_net_worth })),
    assets.map((a) => ({
      valueCents: parseMoneyToCents(a.value),
      includeInNetWorth: a.include_in_net_worth,
      linkedAccountId: a.linked_account_id,
    })),
    liabilities.map((l) => ({
      balanceCents: parseMoneyToCents(l.balance),
      includeInNetWorth: l.include_in_net_worth,
      linkedAccountId: l.linked_account_id,
    }))
  );

  const previous = snapshots.length >= 2 ? parseMoneyToCents(snapshots[snapshots.length - 2].net_worth) : null;

  return {
    netWorthCents: breakdown.netWorthCents,
    totalAssetsCents: breakdown.totalAssetsCents,
    totalLiabilitiesCents: breakdown.totalLiabilitiesCents,
    changeVsPreviousCents: previous !== null ? breakdown.netWorthCents - previous : null,
  };
}

async function gatherHealthCheckInputs(admin: AdminClient, userId: string): Promise<HealthCheckInputs> {
  const current = monthRange(0);
  const previous = monthRange(1);

  const [currentTx, prevTx] = await Promise.all([
    getTransactionsForUser(admin, userId, current.from, current.to),
    getTransactionsForUser(admin, userId, previous.from, previous.to),
  ]);

  const [budget, netWorth] = await Promise.all([
    getBudgetStatusForUser(admin, userId, currentTx),
    getNetWorthSummaryForUser(admin, userId),
  ]);

  // v1 scope decision (see the proactive-check-in plan): priorityAction
  // would need getLifeStageAndPriorities() — the deepest existing call
  // chain in the app — reimplemented against an explicit userId. The
  // check-in's own message derives "the one thing to flag" from
  // risks[0]/overallStatus instead (see money-coach.ts's
  // buildCheckinSystemPrompt), so this stays narrow rather than becoming a
  // second copy of half the tool layer.
  return { currentTx, prevTx, budget, netWorth, priorityAction: null };
}

export async function buildMonthlyHealthCheckForUser(admin: AdminClient, userId: string): Promise<MonthlyHealthCheck> {
  const inputs = await gatherHealthCheckInputs(admin, userId);
  return computeMonthlyHealthCheck(inputs);
}
