import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/features/accounts/queries";
import { getLiabilities } from "@/features/liabilities/queries";
import { getNetWorthBreakdown } from "@/features/net-worth/queries";
import { getCurrentMonthRange, getTransactions } from "@/features/transactions/queries";
import { calculateExpenses, calculateIncome } from "@/lib/financial/calculations";
import type { ForecastAssumptions, ForecastStartingState } from "@/lib/financial/forecast";
import { ZERO_ASSUMPTIONS } from "@/lib/financial/forecast";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import type { AccountType, ForecastScenario } from "@/types/database";

const LIQUID_ACCOUNT_TYPES: AccountType[] = ["cash", "bank", "e_wallet"];

/** The live snapshot every forecast projects forward from. Never stored — always read fresh. */
export async function getForecastStartingState(): Promise<ForecastStartingState> {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const from = toLocalDateString(threeMonthsAgo);
  const to = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 0));

  const [accounts, liabilities, netWorth, recentTransactions] = await Promise.all([
    getAccounts(),
    getLiabilities(),
    getNetWorthBreakdown(),
    getTransactions({ from, to }),
  ]);

  const cashBalanceCents = accounts
    .filter((a) => LIQUID_ACCOUNT_TYPES.includes(a.account_type))
    .reduce((sum, a) => sum + parseMoneyToCents(a.current_balance), 0);

  // Average of the last 3 full months as the "current run rate" — smooths
  // out one-off spikes better than a single month would. Falls back to the
  // current in-progress month when there are fewer than 3 full months of
  // history yet (e.g. a brand-new user) — without this, a new user with
  // only this-month transactions would get a $0 income/expense baseline,
  // producing a flat, misleading forecast instead of an honest first
  // estimate from the data they do have.
  let monthlyIncomeCents = Math.round(calculateIncome(recentTransactions) / 3);
  let monthlyExpensesCents = Math.round(calculateExpenses(recentTransactions) / 3);

  if (recentTransactions.length === 0) {
    const { from: currentFrom, to: currentTo } = getCurrentMonthRange();
    const currentMonthTransactions = await getTransactions({ from: currentFrom, to: currentTo });
    monthlyIncomeCents = calculateIncome(currentMonthTransactions);
    monthlyExpensesCents = calculateExpenses(currentMonthTransactions);
  }

  // Excludes linked liabilities (migration 0013) for the same reason
  // calculateNetWorth() does: a linked liability's debt is already
  // reflected in its linked account's (negative) balance, which flows
  // into `netWorthCents` above. If this figure also included a linked
  // liability's balance, calculateForecast()'s month-by-month projection
  // would "pay it off" twice as the horizon progresses — the shrinking
  // `debt` variable improves projected net worth, while the linked
  // account's balance baked into the projection's frozen "other net
  // worth" baseline never correspondingly improves, so the same debt's
  // payoff would inflate net worth growth beyond what actually happens
  // for every month debt paydown is simulated, not just when balances
  // happen to mismatch. Verified in tests/forecast-linked-liability.test.ts.
  //
  // This is deliberately narrower than getDefaultBaseAssumptions()'s
  // `monthlyDebtPaymentCents` below, which correctly includes ALL
  // liabilities regardless of link status — "how much do I pay toward
  // debt" is a Debt Engine question, unaffected by linking; this
  // `totalDebtCents` figure is a Net-Worth-projection input, which must
  // follow Net Worth's own linking rule instead.
  const totalDebtCents = liabilities
    .filter((l) => l.include_in_net_worth && l.linked_account_id === null)
    .reduce((sum, l) => sum + parseMoneyToCents(l.balance), 0);

  return {
    cashBalanceCents,
    monthlyIncomeCents,
    monthlyExpensesCents,
    netWorthCents: netWorth.netWorthCents,
    totalDebtCents,
  };
}

/** A reasonable Base Case default: no growth assumed, debt payments continue at current minimums, nothing extra allocated — the user is expected to adjust from here. */
export async function getDefaultBaseAssumptions(): Promise<ForecastAssumptions> {
  const liabilities = await getLiabilities();
  const monthlyDebtPaymentCents = liabilities
    .filter((l) => l.include_in_net_worth)
    .reduce((sum, l) => sum + (l.minimum_payment ? parseMoneyToCents(l.minimum_payment) : 0), 0);

  return { ...ZERO_ASSUMPTIONS, monthlyDebtPaymentCents };
}

export async function getForecastScenarios(): Promise<ForecastScenario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forecast_scenarios")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Failed to load forecast scenarios");
  return data ?? [];
}

export async function getForecastScenario(id: string): Promise<ForecastScenario | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("forecast_scenarios").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Failed to load forecast scenario");
  return data;
}

export function scenarioRowToAssumptions(scenario: ForecastScenario): ForecastAssumptions {
  return {
    incomeGrowthRatePercent: Number(scenario.income_growth_rate),
    expenseGrowthRatePercent: Number(scenario.expense_growth_rate),
    monthlySavingsCents: parseMoneyToCents(scenario.monthly_savings),
    monthlyInvestmentCents: parseMoneyToCents(scenario.monthly_investment),
    monthlyDebtPaymentCents: parseMoneyToCents(scenario.monthly_debt_payment),
    oneTimeIncomeCents: parseMoneyToCents(scenario.one_time_income),
    oneTimeIncomeMonth: scenario.one_time_income_month ? monthOffsetFromToday(scenario.one_time_income_month) : null,
    oneTimeExpenseCents: parseMoneyToCents(scenario.one_time_expense),
    oneTimeExpenseMonth: scenario.one_time_expense_month
      ? monthOffsetFromToday(scenario.one_time_expense_month)
      : null,
  };
}

/** Converts a YYYY-MM-DD date into a 1-indexed "months from now" offset, for use as a forecast month index. */
function monthOffsetFromToday(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  return (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()) + 1;
}
