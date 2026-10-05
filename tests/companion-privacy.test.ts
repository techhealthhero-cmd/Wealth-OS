import { describe, expect, it } from "vitest";

import {
  COMPANION_FINANCIAL_SCOPES,
  isCompanionFinancialDataLocked,
} from "@/features/companions/privacy";
import {
  DEFAULT_ACCOUNT_PRIVACY_STATE,
  FAIL_CLOSED_ACCOUNT_PRIVACY_STATE,
} from "@/features/account-privacy/types";

describe("companion financial privacy", () => {
  it("covers every financial privacy scope used by companion facts and tips", () => {
    expect(COMPANION_FINANCIAL_SCOPES).toEqual([
      "accounts",
      "assets",
      "overview",
      "activity",
      "planning",
      "insights",
    ]);
  });

  it("blocks companion facts when any protected scope is locked", () => {
    for (const field of [
      "protectAccounts",
      "protectAssets",
      "protectOverview",
      "protectActivity",
      "protectPlanning",
      "protectInsights",
    ] as const) {
      expect(
        isCompanionFinancialDataLocked({
          ...DEFAULT_ACCOUNT_PRIVACY_STATE,
          enabled: true,
          isUnlocked: false,
          protectAccounts: false,
          [field]: true,
        })
      ).toBe(true);
    }
  });

  it("allows companion facts after unlock and fails closed on load errors", () => {
    expect(
      isCompanionFinancialDataLocked({
        ...FAIL_CLOSED_ACCOUNT_PRIVACY_STATE,
        isUnlocked: true,
      })
    ).toBe(false);
    expect(isCompanionFinancialDataLocked(FAIL_CLOSED_ACCOUNT_PRIVACY_STATE)).toBe(true);
  });
});
