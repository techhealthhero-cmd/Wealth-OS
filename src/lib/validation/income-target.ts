import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export const PREFERRED_INCOME_TYPES = ["active", "passive", "any"] as const;
export const WORK_MODE_PREFERENCES = ["online", "offline", "both", "any"] as const;

export function buildIncomeTargetSchema(dict: Dictionary) {
  return z.object({
    target_monthly_income: z.coerce.number().min(0, dict.validation.enterValidAmount).nullable().optional(),
    desired_extra_income: z.coerce.number().min(0, dict.validation.enterValidAmount).nullable().optional(),
    target_date: z.string().nullable().optional(),
    preferred_income_type: z.enum(PREFERRED_INCOME_TYPES).default("any"),
    max_hours_per_week: z.coerce.number().min(0).max(168).nullable().optional(),
    max_startup_cost: z.coerce.number().min(0, dict.validation.enterValidAmount).nullable().optional(),
    work_mode_preference: z.enum(WORK_MODE_PREFERENCES).default("any"),
  });
}

export type IncomeTargetFormValues = z.infer<ReturnType<typeof buildIncomeTargetSchema>>;
