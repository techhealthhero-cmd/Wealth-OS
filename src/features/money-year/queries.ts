import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getTransactions, type TransactionWithRelations } from "@/features/transactions/queries";
import { getEmergencyFund } from "@/features/emergency-fund/queries";
import {
  calculateDebtReductionContributions,
  calculateIncome,
  calculateInvestmentContributions,
  calculateSavingsContributions,
} from "@/lib/financial/calculations";
import {
  calculatePlanProgress,
  calculatePlanScheduleStatus,
  calculateQuarterElapsedFraction,
  calculateYearElapsedFraction,
  type PlanProgress,
  type PlanScheduleStatus,
} from "@/lib/financial/money-year";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import type { MoneyYear, MoneyYearMajorExpense, QuarterlyPlan } from "@/types/database";
import { throwDbError } from "@/lib/db-error";

export async function getMoneyYears(): Promise<MoneyYear[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("money_years").select("*").order("year", { ascending: false });
  if (error) throwDbError(error, "money-year.getMoneyYears", "Failed to load money years");
  return data ?? [];
}

export async function getMoneyYear(year: number): Promise<MoneyYear | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("money_years").select("*").eq("year", year).maybeSingle();
  if (error) throwDbError(error, "money-year.getMoneyYear", "Failed to load money year");
  return data;
}

export async function getQuarterlyPlans(moneyYearId: string): Promise<QuarterlyPlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quarterly_plans")
    .select("*")
    .eq("money_year_id", moneyYearId)
    .order("quarter", { ascending: true });
  if (error) throwDbError(error, "money-year.getQuarterlyPlans", "Failed to load quarterly plans");
  return data ?? [];
}

export async function getMajorExpenses(moneyYearId: string): Promise<MoneyYearMajorExpense[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("money_year_major_expenses")
    .select("*")
    .eq("money_year_id", moneyYearId)
    .order("planned_month", { ascending: true, nullsFirst: false });
  if (error) throwDbError(error, "money-year.getMajorExpenses", "Failed to load major expenses");
  return data ?? [];
}

export interface AnnualMetric {
  key: "income" | "savings" | "investment" | "debtReduction" | "emergencyFund";
  progress: PlanProgress;
  status: PlanScheduleStatus;
}

export interface MoneyYearSummary {
  moneyYear: MoneyYear;
  metrics: AnnualMetric[];
  quarters: QuarterlyPlan[];
  majorExpenses: MoneyYearMajorExpense[];
  /**
   * The full year's transactions, exposed so the caller can derive each
   * quarter's summary (`getQuarterlySummary`) by filtering this array in
   * memory instead of issuing one more `transactions` query per quarter
   * (perf audit finding: this was a real N+1 — 4 extra DB round-trips for
   * data already sitting in this same response).
   */
  transactions: TransactionWithRelations[];
}

/**
 * Joins the annual plan's targets against real actuals — income/savings/
 * investment/debt-reduction come from this year's transactions (never a
 * second stored "actual" column, per the task's no-duplication rule);
 * emergency fund progress reads the live emergency_funds balance, since
 * that target is "reach this balance", not "contribute this much this year".
 */
export async function getMoneyYearSummary(year: number): Promise<MoneyYearSummary | null> {
  const moneyYear = await getMoneyYear(year);
  if (!moneyYear) return null;

  const from = toLocalDateString(new Date(year, 0, 1));
  const to = toLocalDateString(new Date(year, 11, 31));

  const [transactions, emergencyFund, quarters, majorExpenses] = await Promise.all([
    getTransactions({ from, to }),
    getEmergencyFund(),
    getQuarterlyPlans(moneyYear.id),
    getMajorExpenses(moneyYear.id),
  ]);

  const elapsedFraction = calculateYearElapsedFraction(year);

  const buildMetric = (key: AnnualMetric["key"], actualCents: number, targetCents: number): AnnualMetric => ({
    key,
    progress: calculatePlanProgress(actualCents, targetCents),
    status: calculatePlanScheduleStatus(actualCents, targetCents, elapsedFraction),
  });

  const metrics: AnnualMetric[] = [
    buildMetric("income", calculateIncome(transactions), parseMoneyToCents(moneyYear.annual_income_target)),
    buildMetric(
      "savings",
      calculateSavingsContributions(transactions),
      parseMoneyToCents(moneyYear.annual_savings_target)
    ),
    buildMetric(
      "investment",
      calculateInvestmentContributions(transactions),
      parseMoneyToCents(moneyYear.annual_investment_target)
    ),
    buildMetric(
      "debtReduction",
      calculateDebtReductionContributions(transactions),
      parseMoneyToCents(moneyYear.annual_debt_reduction_target)
    ),
    buildMetric(
      "emergencyFund",
      emergencyFund ? parseMoneyToCents(emergencyFund.current_amount) : 0,
      parseMoneyToCents(moneyYear.annual_emergency_fund_target)
    ),
  ];

  return { moneyYear, metrics, quarters, majorExpenses, transactions };
}

export interface QuarterlyMetric {
  key: "income" | "savings" | "investment" | "debtReduction";
  progress: PlanProgress;
  status: PlanScheduleStatus;
}

export interface QuarterlySummary {
  plan: QuarterlyPlan;
  metrics: QuarterlyMetric[];
}

function quarterDateRange(year: number, quarter: number): { from: string; to: string } {
  const startMonth = (quarter - 1) * 3;
  const from = toLocalDateString(new Date(year, startMonth, 1));
  const to = toLocalDateString(new Date(year, startMonth + 3, 0));
  return { from, to };
}

/**
 * Takes the year's already-fetched transactions (see `MoneyYearSummary.
 * transactions`) and filters to this quarter's date range in memory,
 * instead of querying the database again per quarter — same filtering
 * boundary (`transaction_date` within `[from, to]`) as the removed
 * `getTransactions({from, to})` call, so results are identical.
 */
export function getQuarterlySummary(year: number, plan: QuarterlyPlan, yearTransactions: TransactionWithRelations[]): QuarterlySummary {
  const { from, to } = quarterDateRange(year, plan.quarter);
  const transactions = yearTransactions.filter((t) => t.transaction_date >= from && t.transaction_date <= to);
  const elapsedFraction = calculateQuarterElapsedFraction(year, plan.quarter);

  const buildMetric = (key: QuarterlyMetric["key"], actualCents: number, targetCents: number): QuarterlyMetric => ({
    key,
    progress: calculatePlanProgress(actualCents, targetCents),
    status: calculatePlanScheduleStatus(actualCents, targetCents, elapsedFraction),
  });

  const metrics: QuarterlyMetric[] = [
    buildMetric("income", calculateIncome(transactions), parseMoneyToCents(plan.income_target)),
    buildMetric("savings", calculateSavingsContributions(transactions), parseMoneyToCents(plan.savings_target)),
    buildMetric(
      "investment",
      calculateInvestmentContributions(transactions),
      parseMoneyToCents(plan.investment_target)
    ),
    buildMetric(
      "debtReduction",
      calculateDebtReductionContributions(transactions),
      parseMoneyToCents(plan.debt_reduction_target)
    ),
  ];

  return { plan, metrics };
}
