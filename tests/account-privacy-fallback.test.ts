import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACCOUNT_PRIVACY_STATE,
  FAIL_CLOSED_ACCOUNT_PRIVACY_STATE,
} from "@/features/account-privacy/types";

describe("account privacy fallback", () => {
  it("allows account loading only when the privacy service confirms the default state", () => {
    expect(DEFAULT_ACCOUNT_PRIVACY_STATE).toMatchObject({ enabled: false, isUnlocked: true });
  });

  it("fails closed without exposing financial data when the privacy service is unavailable", () => {
    expect(FAIL_CLOSED_ACCOUNT_PRIVACY_STATE).toMatchObject({
      enabled: true,
      displayStyle: "unavailable",
      isUnlocked: false,
    });
  });
});
