import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export const GOAL_TYPES = [
  "emergency_fund",
  "travel",
  "gadget",
  "car",
  "home",
  "education",
  "wedding",
  "business_capital",
  "million",
  "retirement",
  "custom",
] as const;

export const GOAL_PRIORITIES = ["critical", "high", "medium", "low"] as const;

export function buildGoalSchema(dict: Dictionary) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, dict.validation.accountNameRequired)
      .max(80, dict.validation.accountNameTooLong),
    goal_type: z.enum(GOAL_TYPES, { message: dict.validation.chooseValidAccountType }),
    target_amount: z.coerce
      .number()
      .positive(dict.validation.amountRequired)
      .refine((n) => Math.abs(n) < 10 ** 15, dict.validation.amountTooLarge),
    current_amount: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    target_date: z.string().nullable().optional(),
    priority: z.enum(GOAL_PRIORITIES).default("medium"),
    monthly_contribution: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
    linked_account_id: z.string().uuid().nullable().optional(),
  });
}

export type GoalFormValues = z.infer<ReturnType<typeof buildGoalSchema>>;

export function buildUpdateGoalSchema(dict: Dictionary) {
  return buildGoalSchema(dict).partial();
}
