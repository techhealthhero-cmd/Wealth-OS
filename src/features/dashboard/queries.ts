import "server-only";

import { getDisplayAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getFinancialTransactions, getTransactions } from "@/features/transactions/queries";
import { calendarMonth, todayInTimeZone, toLocalDateString } from "@/lib/date";
import { withPerfLog } from "@/lib/dev-diagnostics";
import {
  calculateChangePercent,
  calculateIncome,
  calculateExpenses,
  calculateMonthlyCashFlow,
  calculateSavingsRate,
  calculateSpendingByCategory,
} from "@/lib/financial/calculations";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/observability";
import { isMissingRelation } from "@/features/earn/v2-queries";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { throwDbError } from "@/lib/db-error";
import {
  aggregateIncomeBySource,
  getIncomeQueryRange,
  toTrackingStartMonth,
  type IncomeBySourceSummary,
  type IncomeSourceTransaction,
} from "./lib/income-by-source";
import { fetchAllPages, fetchInBatches } from "./lib/paged-fetch";

export interface MonthlyIncomeExpensePoint {
  /** "YYYY-MM" — a stable sort/dedupe key, formatted for display by the caller (locale-aware). */
  monthKey: string;
  monthDate: Date;
  incomeCents: number;
  expensesCents: number;
}

const INCOME_EXPENSE_TREND_MONTHS = 6;

/**
 * Last 6 calendar months of income/expense, one point per month — matches
 * the existing "last 6 months" convention already used for the net worth
 * trend chart (net-worth-hero.tsx).
 *
 * The whole window is fetched in one range query and bucketed in memory.
 * This replaces six PostgREST round trips with one while transferring the
 * same transaction rows. Always includes exactly 6 points, even for a
 * month with zero transactions, so the trend line never silently skips a
 * quiet month.
 */
export function getIncomeExpenseTrend() {
  return withPerfLog("getIncomeExpenseTrend", async (): Promise<MonthlyIncomeExpensePoint[]> => {
    const now = new Date();
    const months = Array.from({ length: INCOME_EXPENSE_TREND_MONTHS }, (_, idx) => {
      const i = INCOME_EXPENSE_TREND_MONTHS - 1 - idx;
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthFrom = toLocalDateString(monthDate);
      const monthTo = toLocalDateString(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
      return { monthDate, monthFrom, monthTo };
    });

    const transactions = await getFinancialTransactions({
      from: months[0].monthFrom,
      to: months[months.length - 1].monthTo,
    });
    const transactionsByMonth = new Map<string, typeof transactions>();

    for (const transaction of transactions) {
      const monthKey = transaction.transaction_date.slice(0, 7);
      const bucket = transactionsByMonth.get(monthKey);
      if (bucket) bucket.push(transaction);
      else transactionsByMonth.set(monthKey, [transaction]);
    }

    return months.map(({ monthDate, monthFrom }) => {
      const monthKey = monthFrom.slice(0, 7);
      const monthTransactions = transactionsByMonth.get(monthKey) ?? [];
      return {
        monthKey,
        monthDate,
        incomeCents: calculateIncome(monthTransactions),
        expensesCents: calculateExpenses(monthTransactions),
      };
    });
  });
}

/** Home only needs existence, not monthly totals, comparisons or previews. */
export async function hasAnyDashboardData(today = todayInTimeZone()): Promise<boolean> {
  const accounts = await getDisplayAccounts();
  if (accounts.length > 0) return true;

  const { from, to } = calendarMonth(today);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .limit(1);
  if (error) throwDbError(error, "dashboard.hasAnyDashboardData", "Failed to check dashboard data");
  return (data?.length ?? 0) > 0;
}

export function getDashboardData(today = todayInTimeZone()) {
  return withPerfLog("getDashboardData", async () => {
  const { from, to } = calendarMonth(today);
  const { from: prevFrom, to: prevTo } = calendarMonth(today, -1);

  const [monthTransactions, prevMonthTransactions, recentTransactions, accounts, categories] = await Promise.all([
    getFinancialTransactions({ from, to }),
    getFinancialTransactions({ from: prevFrom, to: prevTo }),
    // 2026-09 Home redesign: recent transactions is now a 3-item preview
    // behind the "show more details" toggle (full history at
    // /money/transactions), not a 5-item list rendered by default.
    getTransactions({ limit: 3 }),
    getDisplayAccounts(),
    getCategories(),
  ]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const incomeCents = calculateIncome(monthTransactions);
  const expensesCents = calculateExpenses(monthTransactions);
  const cashFlowCents = calculateMonthlyCashFlow(monthTransactions);
  const savingsRatePercent = calculateSavingsRate(monthTransactions);

  const prevIncomeCents = calculateIncome(prevMonthTransactions);
  const prevExpensesCents = calculateExpenses(prevMonthTransactions);
  const prevCashFlowCents = calculateMonthlyCashFlow(prevMonthTransactions);
  const prevSavingsRatePercent = calculateSavingsRate(prevMonthTransactions);

  return {
    incomeCents,
    expensesCents,
    cashFlowCents,
    savingsRatePercent,
    hasMonthData: monthTransactions.length > 0,
    incomeChangePercent: calculateChangePercent(incomeCents, prevIncomeCents),
    expensesChangePercent: calculateChangePercent(expensesCents, prevExpensesCents),
    cashFlowChangePercent: calculateChangePercent(cashFlowCents, prevCashFlowCents),
    // Savings rate is already a percentage, so its "change" is a percentage-
    // point difference (e.g. 30% -> 35% is "+5pp"), never a percent-of-a-
    // percent via calculateChangePercent — that would read as a much larger,
    // misleading swing for the same underlying move.
    savingsRateChangePoints: prevMonthTransactions.length > 0 ? savingsRatePercent - prevSavingsRatePercent : null,
    spendingByCategory: calculateSpendingByCategory(monthTransactions).map((entry) => {
      const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;
      return {
        ...entry,
        categoryNameEn: category?.name_en ?? null,
        categoryNameTh: category?.name_th ?? null,
      };
    }),
    accounts,
    categories,
    recentTransactions,
    hasAnyData: accounts.length > 0 || monthTransactions.length > 0,
  };
  });
}

export interface IncomeBySourceData {
  summary: IncomeBySourceSummary;
  /** The user's calendar "today" ("YYYY-MM-DD") the summary was measured to. */
  today: string;
}

/** Earliest transaction date of any type — the month the user started tracking. */
async function getEarliestTransactionDate(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_date")
    .order("transaction_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throwDbError(error, "dashboard.getEarliestTransactionDate", "Failed to load first transaction date");
  return data?.transaction_date ?? null;
}

/**
 * Income rows in [from, to] with a narrow select, paged past the PostgREST
 * row cap. Ordered by (transaction_date, id) so pages never overlap or skip.
 */
async function getIncomeTransactionsInRange(from: string, to: string): Promise<IncomeSourceTransaction[]> {
  const supabase = await createClient();
  return fetchAllPages(async (start, end) => {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, type, amount, category_id, transaction_date")
      .eq("type", "income")
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .order("transaction_date", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end);
    if (error) throwDbError(error, "dashboard.getIncomeTransactionsInRange", "Failed to load income transactions");
    return (data ?? []) as IncomeSourceTransaction[];
  });
}

/**
 * Earn path titles for the given income transactions, looked up in batches
 * of ids. Read-only; a database without the Earn v2 tables (or any other
 * read failure) simply falls back to category grouping — this is a label
 * lookup, never worth failing Home over.
 */
async function getIncomePathLinks(transactionIds: string[]): Promise<Map<string, { pathId: string; title: string }>> {
  const links = new Map<string, { pathId: string; title: string }>();
  if (transactionIds.length === 0) return links;
  const supabase = await createClient();
  try {
    const rows = await fetchInBatches(transactionIds, async (batch) => {
      const { data, error } = await supabase
        .from("earn_transaction_links")
        .select("transaction_id, income_path:income_paths!earn_transaction_links_income_path_id_fkey(id, title)")
        .in("transaction_id", batch);
      if (error) throw error;
      return data ?? [];
    });
    for (const row of rows) {
      const path = (Array.isArray(row.income_path) ? row.income_path[0] : row.income_path) as
        | { id: string; title: string }
        | null;
      if (path) links.set(row.transaction_id, { pathId: path.id, title: path.title });
    }
  } catch (error) {
    if (!isMissingRelation(error as { code?: string })) {
      captureError(error, { route: "dashboard.IncomeThisMonth", operation: "load_earn_transaction_links" });
    }
    links.clear();
  }
  return links;
}

/**
 * Home "income this month" card: received income this month (to `today`)
 * and the previous 6 complete months, grouped by source. `today` must be the
 * user's calendar day — todayInTimeZone(profile.timezone) — not server-local.
 * Reads `transactions` (paged income rows + the earliest date of any type),
 * `categories`, and optionally `earn_transaction_links` → `income_paths` —
 * all read-only and RLS-scoped to the user. The grouping/averages are
 * display-only (lib/income-by-source.ts).
 */
export function getIncomeBySourceData(locale: Locale, today: string) {
  return withPerfLog("getIncomeBySourceData", async (): Promise<IncomeBySourceData> => {
    const { from, to } = getIncomeQueryRange(today);

    const [incomeTransactions, earliestDate, categories] = await Promise.all([
      getIncomeTransactionsInRange(from, to),
      getEarliestTransactionDate(),
      getCategories(),
    ]);
    const pathLinks = await getIncomePathLinks(incomeTransactions.map((t) => t.id));

    const dict = getDictionary(locale);
    const summary = aggregateIncomeBySource({
      today,
      transactions: incomeTransactions,
      trackingStartMonth: toTrackingStartMonth(earliestDate),
      pathLinks,
      categoryNames: new Map(categories.map((c) => [c.id, locale === "th" ? c.name_th : c.name_en])),
      labels: { uncategorized: dict.homeIncome.uncategorized, other: dict.homeIncome.other },
    });
    return { summary, today };
  });
}
