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
 * Removes every account field that can reveal an identity or balance before
 * the value is passed to Client Components. IDs and account types remain so
 * forms can still save valid transactions while privacy mode is locked.
 */
export function redactAccountsForPrivacy(
  accounts: Account[],
  privacy: AccountPrivacyState
): PrivacySafeAccount[] {
  if (!privacy.enabled || privacy.isUnlocked) return accounts;

  return accounts.map((account, index) => ({
    ...account,
    name: `•••• ${index + 1}`,
    institution: null,
    opening_balance: "0",
    current_balance: "0",
    __privacyRedacted: true,
    __privacyIndex: index + 1,
  }));
}

interface AccountRelation {
  id: string;
  name: string;
}

interface RowWithAccountRelations {
  account: AccountRelation | null;
  from_account: AccountRelation | null;
  to_account: AccountRelation | null;
}

/**
 * Joined transaction rows contain their own copies of account names. Scrub
 * those copies too; sanitizing only the separate account array would still
 * leave the original names in the React payload and transaction history.
 */
export function redactAccountRelationsForPrivacy<T extends RowWithAccountRelations>(
  rows: T[],
  accounts: PrivacySafeAccount[]
): T[] {
  if (!accounts.some(isAccountPrivacyRedacted)) return rows;

  const displayNameById = new Map(accounts.map((account) => [account.id, account.name]));
  const redactRelation = (relation: AccountRelation | null): AccountRelation | null =>
    relation
      ? { ...relation, name: displayNameById.get(relation.id) ?? "••••" }
      : null;

  return rows.map((row) => ({
    ...row,
    account: redactRelation(row.account),
    from_account: redactRelation(row.from_account),
    to_account: redactRelation(row.to_account),
  }));
}
