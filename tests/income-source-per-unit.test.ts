import { describe, expect, it } from "vitest";

import { calculatePerUnitMonthlyCents } from "@/lib/financial/per-unit-income";
import { buildIncomeSourceSchema, usesPayBasisMigration } from "@/lib/validation/income-source";
import { getDictionary } from "@/i18n/dictionaries";

const dict = getDictionary("th");
const base = { name: "โฮส", source_type: "commission", stability: "variable", is_active: true, notes: null };

describe("calculatePerUnitMonthlyCents", () => {
  it("multiplies rate by units in exact cents", () => {
    expect(calculatePerUnitMonthlyCents(20_000, 150)).toBe(3_000_000); // ฿200 × 150 = ฿30,000
    expect(calculatePerUnitMonthlyCents(15_050, 12.5)).toBe(188_125); // fractional units round once
  });

  it("returns 0 for missing, zero, negative or non-finite inputs", () => {
    expect(calculatePerUnitMonthlyCents(20_000, 0)).toBe(0);
    expect(calculatePerUnitMonthlyCents(0, 10)).toBe(0);
    expect(calculatePerUnitMonthlyCents(-100, 10)).toBe(0);
    expect(calculatePerUnitMonthlyCents(Number.NaN, 10)).toBe(0);
  });
});

describe("income source schema — per-unit pay", () => {
  const schema = buildIncomeSourceSchema(dict);

  it("derives the monthly figure on the server, ignoring any client-sent total", () => {
    const r = schema.safeParse({
      ...base,
      frequency: "semimonthly",
      pay_basis: "per_unit",
      unit_rate: "200",
      unit_label: "ดื่ม",
      expected_units_per_month: "150",
      expected_monthly_income: "999999",
    });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ expected_monthly_income: 30_000, unit_rate: 200, unit_label: "ดื่ม", expected_units_per_month: 150, frequency: "semimonthly" });
  });

  it("requires both the rate and the monthly count", () => {
    const r = schema.safeParse({ ...base, frequency: "monthly", pay_basis: "per_unit", unit_rate: "", expected_units_per_month: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(["unit_rate", "expected_units_per_month"]);
  });

  it("fixed pay keeps the typed amount and clears unit data", () => {
    const r = schema.safeParse({ ...base, frequency: "monthly", pay_basis: "fixed", expected_monthly_income: "30000", unit_rate: "200", expected_units_per_month: "150" });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ expected_monthly_income: 30_000, unit_rate: null, unit_label: null, expected_units_per_month: null });
  });

  it("defaults to fixed pay when the form omits pay_basis (older clients)", () => {
    const r = schema.safeParse({ ...base, frequency: "monthly", expected_monthly_income: "5000" });
    expect(r.success).toBe(true);
    expect(r.data?.pay_basis).toBe("fixed");
  });

  it("flags only per-unit or semimonthly values as needing migration 0036", () => {
    expect(usesPayBasisMigration({ pay_basis: "fixed", frequency: "monthly" })).toBe(false);
    expect(usesPayBasisMigration({ pay_basis: "per_unit", frequency: "monthly" })).toBe(true);
    expect(usesPayBasisMigration({ pay_basis: "fixed", frequency: "semimonthly" })).toBe(true);
  });
});
