import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export function buildBudgetSchema(dict: Dictionary) {
  return z.object({
    month: z.string().regex(/^\d{4}-\d{2}-01$/, dict.validation.selectValidDate),
    total_budget: z.coerce
      .number()
      .finite(dict.validation.enterValidAmount)
      .min(0, dict.validation.enterValidAmount)
      .refine((n) => Math.abs(n) < 10 ** 15, dict.validation.amountTooLarge),
    planned_savings: z.coerce
      .number()
      .finite(dict.validation.enterValidAmount)
      .min(0, dict.validation.enterValidAmount)
      .default(0),
    planned_investment: z.coerce
      .number()
      .finite(dict.validation.enterValidAmount)
      .min(0, dict.validation.enterValidAmount)
      .default(0),
    notes: z.string().trim().max(1000, dict.validation.notesTooLong).optional().or(z.literal("")),
  });
}

export type BudgetFormValues = z.infer<ReturnType<typeof buildBudgetSchema>>;

export function buildBudgetCategorySchema(dict: Dictionary) {
  return z.object({
    category_id: z.string().uuid(dict.validation.selectAccount),
    amount: z.coerce
      .number()
      .finite(dict.validation.enterValidAmount)
      .min(0, dict.validation.enterValidAmount),
    is_fixed: z.boolean().default(false),
    is_essential: z.boolean().default(true),
  });
}

export type BudgetCategoryFormValues = z.infer<ReturnType<typeof buildBudgetCategorySchema>>;
