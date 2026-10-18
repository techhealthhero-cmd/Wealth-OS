import { describe, expect, it } from "vitest";

import { purposePillClass } from "@/features/accounts/purpose";
import { buildAccountSchema } from "@/lib/validation/account";
import { getDictionary } from "@/i18n/dictionaries";

const th = getDictionary("th");

describe("account purpose", () => {
  it("colours each preset by its own index and anything else plainly", () => {
    const presets = th.accounts.purposePresets;
    expect(presets).toHaveLength(6);
    const classes = presets.map((p) => purposePillClass(p, presets));
    expect(new Set(classes).size).toBe(6);
    expect(purposePillClass("  ใช้จ่ายรายวัน ", presets)).toBe(classes[0]);
    expect(purposePillClass("เงินเที่ยวญี่ปุ่น", presets)).toBe("bg-muted text-muted-foreground");
  });

  it("accepts an empty or short purpose and rejects one over 40 characters", () => {
    const schema = buildAccountSchema(th);
    const base = { name: "Cash", account_type: "cash" };
    expect(schema.safeParse({ ...base, purpose: "" }).success).toBe(true);
    expect(schema.safeParse({ ...base }).success).toBe(true);
    expect(schema.safeParse({ ...base, purpose: "เก็บออม" }).success).toBe(true);
    const tooLong = schema.safeParse({ ...base, purpose: "ก".repeat(41) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]?.message).toBe(th.validation.accountPurposeTooLong);
  });
});
