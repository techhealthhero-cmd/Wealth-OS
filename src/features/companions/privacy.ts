import "server-only";

import { getAccountPrivacyState } from "@/features/account-privacy/queries";
import {
  isPrivacyLockedFor,
  type AccountPrivacyState,
  type PrivacyScope,
} from "@/features/account-privacy/types";

/**
 * Companion unlocks and tips combine data from budgets, transactions,
 * accounts, assets, plans and insights. Treat them as protected whenever
 * any financial privacy scope they depend on is locked.
 */
export const COMPANION_FINANCIAL_SCOPES = [
  "accounts",
  "assets",
  "overview",
  "activity",
  "planning",
  "insights",
] satisfies PrivacyScope[];

export function isCompanionFinancialDataLocked(privacy: AccountPrivacyState): boolean {
  return isPrivacyLockedFor(privacy, COMPANION_FINANCIAL_SCOPES);
}

export async function getCompanionFinancialDataLocked(): Promise<boolean> {
  return isCompanionFinancialDataLocked(await getAccountPrivacyState());
}
