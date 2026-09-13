import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

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
export const INCOME_FREQUENCIES = ["monthly", "biweekly", "weekly", "irregular", "one_time"] as const;

export function buildIncomeSourceSchema(dict: Dictionary) {
  return z.object({
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
  });
}

export type IncomeSourceFormValues = z.infer<ReturnType<typeof buildIncomeSourceSchema>>;

export function buildUpdateIncomeSourceSchema(dict: Dictionary) {
  return buildIncomeSourceSchema(dict).partial();
}
