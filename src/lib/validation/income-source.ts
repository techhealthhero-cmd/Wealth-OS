import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";
import { calculatePerUnitMonthlyCents } from "@/lib/financial/per-unit-income";
import { centsToDecimalString, parseMoneyToCents } from "@/lib/financial/money";

export const INCOME_SOURCE_TYPES = [
  "salary",
  "freelance",
  "business",
  "commission",
  "bonus",
  "investment",
  "rental",
  "side_hustle",
  "other",
] as const;

export const INCOME_STABILITIES = ["stable", "variable"] as const;
export const INCOME_FREQUENCIES = ["monthly", "semimonthly", "biweekly", "weekly", "irregular", "one_time"] as const;
export const INCOME_PAY_BASES = ["fixed", "per_unit"] as const;

/** Values only the 0036 migration can store — used to tell "needs DB update" apart from other save errors. */
export function usesPayBasisMigration(values: { pay_basis?: string; frequency?: string }): boolean {
  return values.pay_basis === "per_unit" || values.frequency === "semimonthly";
}

const optionalPositive = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().positive().nullable()
);
const optionalNonNegative = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().min(0).nullable()
);

export function buildIncomeSourceSchema(dict: Dictionary) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, dict.validation.accountNameRequired)
        .max(80, dict.validation.accountNameTooLong),
      source_type: z.enum(INCOME_SOURCE_TYPES, { message: dict.validation.chooseValidAccountType }),
      expected_monthly_income: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
      stability: z.enum(INCOME_STABILITIES).default("variable"),
      frequency: z.enum(INCOME_FREQUENCIES).default("monthly"),
      is_active: z.coerce.boolean().default(true),
      notes: z.string().trim().max(500).nullable().optional(),
      pay_basis: z.enum(INCOME_PAY_BASES).default("fixed"),
      unit_rate: optionalPositive,
      unit_label: z.preprocess((v) => (typeof v === "string" && v.trim() ? v : null), z.string().trim().max(40).nullable()),
      expected_units_per_month: optionalNonNegative,
    })
    .superRefine((v, ctx) => {
      if (v.pay_basis !== "per_unit") return;
      if (v.unit_rate === null) ctx.addIssue({ code: "custom", path: ["unit_rate"], message: dict.earn.income.perUnit.rateRequired });
      if (v.expected_units_per_month === null)
        ctx.addIssue({ code: "custom", path: ["expected_units_per_month"], message: dict.earn.income.perUnit.unitsRequired });
    })
    .transform((v) => {
      if (v.pay_basis !== "per_unit") {
        // Fixed pay: the typed monthly amount is the figure; no unit data kept.
        return { ...v, unit_rate: null, unit_label: null, expected_units_per_month: null };
      }
      // Per-unit pay: the monthly figure is always derived on the server, never trusted from the client.
      const rateCents = parseMoneyToCents(v.unit_rate ?? 0);
      const monthlyCents = calculatePerUnitMonthlyCents(rateCents, v.expected_units_per_month ?? 0);
      return {
        ...v,
        unit_rate: Number(centsToDecimalString(rateCents)),
        expected_monthly_income: Number(centsToDecimalString(monthlyCents)),
      };
    });
}

export type IncomeSourceFormValues = z.infer<ReturnType<typeof buildIncomeSourceSchema>>;

/** The edit form always submits every field, so updates validate exactly like creates. */
export function buildUpdateIncomeSourceSchema(dict: Dictionary) {
  return buildIncomeSourceSchema(dict);
}
