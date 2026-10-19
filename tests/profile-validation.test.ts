import { describe, expect, it } from "vitest";

import { createProfileSchema, profileSchema } from "@/lib/validation/profile";
import { PROFILE_CURRENCY_CODES, PROFILE_TIMEZONES } from "@/lib/validation/profile-options";

const base = {
  display_name: "Somchai",
  preferred_language: "th",
  currency_code: "THB",
  timezone: "Asia/Bangkok",
};

describe("profileSchema currency/timezone", () => {
  it("lists THB and Asia/Bangkok first", () => {
    expect(PROFILE_CURRENCY_CODES[0]).toBe("THB");
    expect(PROFILE_TIMEZONES[0]).toBe("Asia/Bangkok");
  });

  it("accepts THB and Asia/Bangkok", () => {
    const parsed = profileSchema.parse(base);
    expect(parsed.currency_code).toBe("THB");
    expect(parsed.timezone).toBe("Asia/Bangkok");
  });

  it("normalises lowercase currency codes", () => {
    expect(profileSchema.parse({ ...base, currency_code: " thb " }).currency_code).toBe("THB");
  });

  it("rejects an unknown currency code", () => {
    expect(profileSchema.safeParse({ ...base, currency_code: "XYZ" }).success).toBe(false);
  });

  it("rejects a bogus timezone", () => {
    expect(profileSchema.safeParse({ ...base, timezone: "Mars/Olympus" }).success).toBe(false);
  });

  it("accepts a legacy value only when it equals the stored profile value", () => {
    const schema = createProfileSchema({ currency_code: "CHF", timezone: "Europe/Berlin" });
    expect(schema.safeParse({ ...base, currency_code: "CHF", timezone: "Europe/Berlin" }).success).toBe(true);
    expect(schema.safeParse({ ...base, currency_code: "XYZ" }).success).toBe(false);
    expect(schema.safeParse({ ...base, timezone: "Europe/Madrid" }).success).toBe(false);
  });
});
