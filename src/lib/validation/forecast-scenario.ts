import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export const FORECAST_SCENARIO_TYPES = ["base", "conservative", "optimistic", "custom"] as const;

export function buildForecastScenarioSchema(dict: Dictionary) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, dict.validation.accountNameRequired)
      .max(80, dict.validation.accountNameTooLong),
    scenario_type: z.enum(FORECAST_SCENARIO_TYPES).default("custom"),
    horizon_months: z.coerce.number().int().min(1).max(120).default(12),
    income_growth_rate: z.coerce.number().default(0),
    expense_growth_rate: z.coerce.number().default(0),
    monthly_savings: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    monthly_investment: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    monthly_debt_payment: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    one_time_income: z.coerce.number().min(0).default(0),
    one_time_income_month: z.string().nullable().optional(),
    one_time_expense: z.coerce.number().min(0).default(0),
    one_time_expense_month: z.string().nullable().optional(),
  });
}

export type ForecastScenarioFormValues = z.infer<ReturnType<typeof buildForecastScenarioSchema>>;
