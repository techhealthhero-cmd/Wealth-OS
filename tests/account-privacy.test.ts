import { describe, expect, it } from "vitest";

import {
  accountPrivacyPinSchema,
  accountPrivacySettingsSchema,
  accountPrivacyUnlockSchema,
} from "@/lib/validation/account-privacy";

describe("account privacy validation", () => {
  it("accepts only a six-digit PIN", () => {
    expect(accountPrivacyPinSchema.safeParse("123456").success).toBe(true);
    expect(accountPrivacyPinSchema.safeParse("12345").success).toBe(false);
    expect(accountPrivacyPinSchema.safeParse("1234567").success).toBe(false);
    expect(accountPrivacyPinSchema.safeParse("12a456").success).toBe(false);
  });

  it("normalizes settings submitted by the privacy form", () => {
    expect(accountPrivacySettingsSchema.parse({
      enabled: "true",
      displayStyle: "custom",
      customMessage: "  Not available  ",
      pin: "123456",
      pinConfirmation: "123456",
    })).toMatchObject({
      enabled: true,
      displayStyle: "custom",
      customMessage: "Not available",
    });
  });

  it("rejects unsupported cover styles and malformed unlock attempts", () => {
    expect(accountPrivacySettingsSchema.safeParse({
      enabled: "true",
      displayStyle: "fake-bank",
      customMessage: "",
      pin: "123456",
    }).success).toBe(false);
    expect(accountPrivacyUnlockSchema.safeParse({ pin: "password" }).success).toBe(false);
  });
});
