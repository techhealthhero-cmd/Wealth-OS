/**
 * Year-to-date "tug of war" between income and expenses, shown on Home.
 *
 * Why a year and not a month: once-a-year lump payments (insurance
 * premiums, car tax, school fees) make the month they land in look like
 * an overspend even when the year is fine. Summing from 1 January smooths
 * those out. All amounts are integer cents; no LLM involved.
 */

export type YearlyBalanceStatus = "surplus" | "deficit" | "even";

export interface YearlyBalance {
  incomeCents: number;
  expensesCents: number;
  /** Income − expenses. Positive = left over, negative = income fell short. */
  netCents: number;
  status: YearlyBalanceStatus;
  /**
   * Surplus: how much income exceeds expenses, as a % of expenses.
   * Deficit: how much expenses exceed income, as a % of income.
   * Null when the base is zero (no meaningful ratio).
   */
  differencePercent: number | null;
  /**
   * Where the green and red bars meet, 0–100 from the left. 50 = even.
   * The offset from the middle is amplified (×1.5 of the gap relative to
   * the larger side) so a modest surplus is still visible, then clamped
   * so neither bar ever disappears completely.
   */
  meetingPointPercent: number;
}

const PUSH_AMPLIFICATION = 150;
const MAX_OFFSET = 42;

export function calculateYearlyBalance(incomeCents: number, expensesCents: number): YearlyBalance {
  const income = Math.max(0, incomeCents);
  const expenses = Math.max(0, expensesCents);
  const netCents = income - expenses;
  const status: YearlyBalanceStatus = netCents > 0 ? "surplus" : netCents < 0 ? "deficit" : "even";

  let differencePercent: number | null = null;
  if (status === "surplus" && expenses > 0) differencePercent = (netCents / expenses) * 100;
  if (status === "deficit" && income > 0) differencePercent = (-netCents / income) * 100;
  if (status === "even" && income > 0) differencePercent = 0;

  const larger = Math.max(income, expenses);
  const rawOffset = larger > 0 ? (netCents / larger) * PUSH_AMPLIFICATION : 0;
  const offset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, rawOffset));

  return {
    incomeCents: income,
    expensesCents: expenses,
    netCents,
    status,
    differencePercent,
    meetingPointPercent: 50 + offset,
  };
}
