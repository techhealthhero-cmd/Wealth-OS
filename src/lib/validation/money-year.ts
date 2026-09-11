import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export function buildMoneyYearSchema(dict: Dictionary) {
  return z.object({
    year: z.coerce.number().int().min(2000).max(2200),
    annual_income_target: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    annual_savings_target: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    annual_investment_target: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    annual_debt_reduction_target: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    annual_emergency_fund_target: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    expected_irregular_income: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    expected_irregular_expenses: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    notes: z.string().trim().max(1000, dict.validation.notesTooLong).optional().or(z.literal("")),
  });
}

export type MoneyYearFormValues = z.infer<ReturnType<typeof buildMoneyYearSchema>>;

export function buildQuarterlyPlanSchema(dict: Dictionary) {
  return z.object({
    quarter: z.coerce.number().int().min(1).max(4),
    income_target: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    savings_target: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    investment_target: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    debt_reduction_target: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    notes: z.string().trim().max(1000, dict.validation.notesTooLong).optional().or(z.literal("")),
  });
}

export type QuarterlyPlanFormValues = z.infer<ReturnType<typeof buildQuarterlyPlanSchema>>;

export function buildMajorExpenseSchema(dict: Dictionary) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, dict.validation.accountNameRequired)
      .max(120, dict.validation.accountNameTooLong),
    amount: z.coerce.number().positive(dict.validation.amountRequired),
    planned_month: z.string().nullable().optional(),
  });
}

export type MajorExpenseFormValues = z.infer<ReturnType<typeof buildMajorExpenseSchema>>;
