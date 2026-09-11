import "server-only";

import { getAccounts } from "@/features/accounts/queries";
import { getLiabilities } from "@/features/liabilities/queries";
import { getEmergencyFund } from "@/features/emergency-fund/queries";
import { getBudgetSummary } from "@/features/budget/queries";
import { calculateSafeToSpend, type SafeToSpendResult } from "@/lib/financial/safe-to-spend";
import { parseMoneyToCents } from "@/lib/financial/money";
import type { AccountType } from "@/types/database";

const LIQUID_ACCOUNT_TYPES: AccountType[] = ["cash", "bank", "e_wallet"];

export interface SafeToSpendComputation {
  hasCompleteData: boolean;
  result: SafeToSpendResult | null;
}

/**
 * Never invents a number: if there isn't at least one account to source
 * "available liquid cash" from, this returns hasCompleteData: false rather
 * than a fabricated Safe-to-Spend figure. Every other input (budget,
 * emergency fund, liabilities) defaults to 0 when absent — a genuinely
 * correct value (nothing planned/protected yet), not a guess.
 */
export async function getSafeToSpend(): Promise<SafeToSpendComputation> {
  const [accounts, liabilities, emergencyFund, budgetSummary] = await Promise.all([
    getAccounts(),
    getLiabilities(),
    getEmergencyFund(),
    getBudgetSummary(),
  ]);

  if (accounts.length === 0) {
    return { hasCompleteData: false, result: null };
  }

  const availableLiquidCents = accounts
    .filter((a) => LIQUID_ACCOUNT_TYPES.includes(a.account_type))
    .reduce((sum, a) => sum + parseMoneyToCents(a.current_balance), 0);

  const minimumDebtPaymentsCents = liabilities
    .filter((l) => l.include_in_net_worth)
    .reduce((sum, l) => sum + (l.minimum_payment ? parseMoneyToCents(l.minimum_payment) : 0), 0);

  const upcomingBillsCents = budgetSummary
    ? budgetSummary.byCategory
        .filter((c) => c.isEssential && c.isFixed)
        .reduce((sum, c) => sum + Math.max(0, c.remainingCents), 0)
    : 0;

  const mandatoryCommitmentsCents = budgetSummary
    ? budgetSummary.byCategory
        .filter((c) => c.isEssential && !c.isFixed)
        .reduce((sum, c) => sum + Math.max(0, c.remainingCents), 0)
    : 0;

  const plannedSavingsCents = budgetSummary ? parseMoneyToCents(budgetSummary.budget.planned_savings) : 0;
  const plannedInvestmentCents = budgetSummary ? parseMoneyToCents(budgetSummary.budget.planned_investment) : 0;
  const protectedEmergencyFundCents = emergencyFund ? parseMoneyToCents(emergencyFund.current_amount) : 0;

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemainingInMonth = daysInMonth - today.getDate() + 1;
  const weeksRemainingInMonth = Math.ceil(daysRemainingInMonth / 7);

  const result = calculateSafeToSpend(
    {
      availableLiquidCents,
      upcomingBillsCents,
      minimumDebtPaymentsCents,
      plannedSavingsCents,
      plannedInvestmentCents,
      protectedEmergencyFundCents,
      mandatoryCommitmentsCents,
    },
    daysRemainingInMonth,
    weeksRemainingInMonth
  );

  return { hasCompleteData: true, result };
}
