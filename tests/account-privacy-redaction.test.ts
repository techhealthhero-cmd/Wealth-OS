import { describe, expect, it } from "vitest";

import {
  isAccountPrivacyRedacted,
  redactAccountRelationsForPrivacy,
  redactAccountsForPrivacy,
} from "@/features/account-privacy/account-redaction";
import {
  DEFAULT_ACCOUNT_PRIVACY_STATE,
  FAIL_CLOSED_ACCOUNT_PRIVACY_STATE,
} from "@/features/account-privacy/types";
import type { Account } from "@/types/database";

const account = {
  id: "account-1",
  user_id: "user-1",
  name: "Secret savings",
  institution: "Secret Bank",
  account_type: "savings",
  currency_code: "THB",
  opening_balance: "1234.56",
  current_balance: "9876.54",
  include_in_net_worth: true,
  is_archived: false,
  sort_order: 0,
  created_at: "2026-09-29T00:00:00.000Z",
  updated_at: "2026-09-29T00:00:00.000Z",
} as Account;

describe("account privacy redaction", () => {
  it("removes account identity and balances while privacy is locked", () => {
    const [redacted] = redactAccountsForPrivacy([account], FAIL_CLOSED_ACCOUNT_PRIVACY_STATE);

    expect(redacted).toMatchObject({
      id: account.id,
      name: "•••• 1",
      institution: null,
      opening_balance: "0",
      current_balance: "0",
      __privacyRedacted: true,
      __privacyIndex: 1,
    });
    expect(JSON.stringify(redacted)).not.toContain("Secret");
    expect(JSON.stringify(redacted)).not.toContain("9876.54");
    expect(isAccountPrivacyRedacted(redacted)).toBe(true);
  });

  it("keeps real account data when privacy is disabled", () => {
    const [visible] = redactAccountsForPrivacy([account], DEFAULT_ACCOUNT_PRIVACY_STATE);

    expect(visible).toBe(account);
    expect(isAccountPrivacyRedacted(visible)).toBe(false);
  });

  it("keeps real account data during an approved temporary unlock", () => {
    const [visible] = redactAccountsForPrivacy([account], {
      ...FAIL_CLOSED_ACCOUNT_PRIVACY_STATE,
      isUnlocked: true,
    });

    expect(visible).toBe(account);
  });

  it("removes duplicated account names from joined transaction rows", () => {
    const redactedAccounts = redactAccountsForPrivacy([account], FAIL_CLOSED_ACCOUNT_PRIVACY_STATE);
    const [transaction] = redactAccountRelationsForPrivacy([
      {
        account: { id: account.id, name: account.name },
        from_account: { id: account.id, name: account.name },
        to_account: { id: "missing-account", name: "Another secret" },
      },
    ], redactedAccounts);

    expect(transaction.account?.name).toBe("•••• 1");
    expect(transaction.from_account?.name).toBe("•••• 1");
    expect(transaction.to_account?.name).toBe("••••");
    expect(JSON.stringify(transaction)).not.toContain("secret");
  });
});
