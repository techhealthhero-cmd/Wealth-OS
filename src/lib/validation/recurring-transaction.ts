import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export const RECURRING_TYPES = ["income", "expense", "transfer"] as const;
export const RECURRING_FREQUENCIES = ["weekly", "biweekly", "monthly", "quarterly", "yearly"] as const;

export function buildRecurringTransactionSchema(dict: Dictionary) {
  return z
    .object({
      type: z.enum(RECURRING_TYPES, { message: dict.validation.chooseValidAccountType }),
      amount: z.coerce.number().positive(dict.validation.amountRequired),
      account_id: z.string().uuid().nullable().optional(),
      from_account_id: z.string().uuid().nullable().optional(),
      to_account_id: z.string().uuid().nullable().optional(),
      category_id: z.string().uuid().nullable().optional(),
      merchant: z.string().trim().max(120).nullable().optional(),
      description: z.string().trim().max(255).nullable().optional(),
      frequency: z.enum(RECURRING_FREQUENCIES),
      start_date: z.string().min(1, dict.validation.selectValidDate),
      end_date: z.string().nullable().optional(),
      is_active: z.coerce.boolean().default(true),
    })
    .refine((data) => (data.type === "transfer" ? !!data.from_account_id && !!data.to_account_id : !!data.account_id), {
      message: dict.validation.selectAccount,
      path: ["account_id"],
    });
}

export type RecurringTransactionFormValues = z.infer<ReturnType<typeof buildRecurringTransactionSchema>>;
