import type { TransactionType } from "@/types/database";
import { parseMoneyToCents } from "./money";

/**
 * Minimal shape calculations need — decoupled from the full Supabase
 * `Transaction` row so these pure functions stay easy to unit test.
 */
export interface FinancialTransaction {
  type: TransactionType;
  amount: string | number;
  category_id?: string | null;
}

function sumByTypes(
  transactions: FinancialTransaction[],
  types: TransactionType[]
): number {
  return transactions
    .filter((t) => types.includes(t.type))
    .reduce((total, t) => total + parseMoneyToCents(t.amount), 0);
}

/** Total income for a set of transactions, in integer cents. */
export function calculateIncome(transactions: FinancialTransaction[]): number {
  return sumByTypes(transactions, ["income"]);
}

/**
 * Total expenses, in integer cents, NET of refunds: a refund is treated as
 * an expense reversal (money that was spent coming back), not as income.
 * This is a deliberate Day-1 policy choice — see README.md "Refund
 * handling" — and keeps `calculateMonthlyCashFlow` simple: cash flow is
 * always `calculateIncome - calculateExpenses`, with refunds already netted
 * in on the expense side.
 *
 * Transfers, debt payments, savings transfers, and investment allocations
 * are intentionally excluded: they move money between the user's own
 * accounts/holdings rather than growing or shrinking their total wealth, so
 * counting them here would misrepresent true income/spending.
 */
export function calculateExpenses(transactions: FinancialTransaction[]): number {
  const gross = sumByTypes(transactions, ["expense"]);
  const refunded = sumByTypes(transactions, ["refund"]);
  return gross - refunded;
}

/** Cash Flow = Income - Expenses (expenses already net of refunds). Transfers excluded. */
export function calculateMonthlyCashFlow(
  transactions: FinancialTransaction[]
): number {
  return calculateIncome(transactions) - calculateExpenses(transactions);
}

/**
 * Savings Rate = (Income - Expenses) / Income * 100.
 *
 * Limitation (documented): this measures cash flow relative to income, not
 * money actually set aside — someone with zero spending and zero explicit
 * savings shows a 100% rate. A later phase should base this on explicit
 * savings/investment allocations instead.
 *
 * Returns 0 when income is 0 (rather than dividing by zero / returning
 * NaN or Infinity) since there is no meaningful rate to report.
 */
export function calculateSavingsRate(
  transactions: FinancialTransaction[]
): number {
  const income = calculateIncome(transactions);
  if (income === 0) return 0;
  const cashFlow = calculateMonthlyCashFlow(transactions);
  return (cashFlow / income) * 100;
}

/**
 * Mirrors the database's `recalc_account_balance` function (see
 * supabase/migrations/0001_init.sql) in pure TypeScript, for unit testing
 * and any client-side preview before a write round-trips to the server.
 * The database trigger remains the source of truth for persisted balances.
 */
export interface AccountBalanceTransaction extends FinancialTransaction {
  account_id?: string | null;
  from_account_id?: string | null;
  to_account_id?: string | null;
}

export function calculateAccountBalance(
  openingBalance: string | number,
  accountId: string,
  transactions: AccountBalanceTransaction[]
): number {
  const debitTypes: TransactionType[] = [
    "expense",
    "debt_payment",
    "savings_transfer",
    "investment_allocation",
  ];

  const net = transactions.reduce((total, t) => {
    const amountCents = parseMoneyToCents(t.amount);

    if (t.type === "transfer") {
      if (t.from_account_id === accountId) return total - amountCents;
      if (t.to_account_id === accountId) return total + amountCents;
      return total;
    }

    if (t.account_id !== accountId) return total;

    if (t.type === "income" || t.type === "refund") return total + amountCents;
    if (debitTypes.includes(t.type)) return total - amountCents;
    return total;
  }, 0);

  return parseMoneyToCents(openingBalance) + net;
}

export interface CategorySpending {
  categoryId: string | null;
  totalCents: number;
}

/** Groups expense totals (net of refunds excluded — refunds are matched by category separately) by category_id. */
export function calculateSpendingByCategory(
  transactions: FinancialTransaction[]
): CategorySpending[] {
  const totals = new Map<string | null, number>();

  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const key = t.category_id ?? null;
    totals.set(key, (totals.get(key) ?? 0) + parseMoneyToCents(t.amount));
  }

  return Array.from(totals.entries())
    .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}
