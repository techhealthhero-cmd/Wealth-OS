import type { Account } from "@/types/database";
import type { AccountPrivacyState } from "./types";

/**
 * Extra, UI-only metadata attached after an account has been sanitized.
 * The double-underscore keys cannot collide with database columns and are
 * serializable across the Server Component boundary.
 */
export type PrivacySafeAccount = Account & {
  __privacyRedacted?: true;
  __privacyIndex?: number;
};

export function isAccountPrivacyRedacted(account: Account): boolean {
  return (account as PrivacySafeAccount).__privacyRedacted === true;
}

/**
 * Removes account balances before the value is passed to Client Components.
 * Names and institutions stay visible so the user can still choose the
 * correct account in transaction forms while privacy mode is locked.
 */
export function redactAccountsForPrivacy(
  accounts: Account[],
  privacy: AccountPrivacyState
): PrivacySafeAccount[] {
  if (!privacy.enabled || !privacy.protectAccounts || privacy.isUnlocked) return accounts;

  return accounts.map((account, index) => ({
    ...account,
    opening_balance: "0",
    current_balance: "0",
    __privacyRedacted: true,
    __privacyIndex: index + 1,
  }));
}
