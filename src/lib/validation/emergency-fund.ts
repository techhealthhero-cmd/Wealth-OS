import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export function buildEmergencyFundSchema(dict: Dictionary) {
  return z
    .object({
      target_months: z.coerce.number().positive().nullable().optional(),
      custom_target_amount: z.coerce.number().positive().nullable().optional(),
      current_amount: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
      monthly_contribution: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
      linked_account_id: z.string().uuid().nullable().optional(),
      linked_goal_id: z.string().uuid().nullable().optional(),
    })
    .refine((data) => Boolean(data.target_months) || Boolean(data.custom_target_amount), {
      message: dict.validation.amountRequired,
      path: ["target_months"],
    });
}

export type EmergencyFundFormValues = z.infer<ReturnType<typeof buildEmergencyFundSchema>>;
