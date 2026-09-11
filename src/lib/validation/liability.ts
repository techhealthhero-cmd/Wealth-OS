import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export const LIABILITY_TYPES = [
  "credit_card",
  "personal_loan",
  "car_loan",
  "mortgage",
  "student_loan",
  "informal_debt",
  "other",
] as const;

export function buildLiabilitySchema(dict: Dictionary) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, dict.validation.accountNameRequired)
      .max(80, dict.validation.accountNameTooLong),
    liability_type: z.enum(LIABILITY_TYPES, { message: dict.validation.chooseValidAccountType }),
    balance: z.coerce
      .number()
      .finite(dict.validation.enterValidAmount)
      .min(0, dict.validation.enterValidAmount)
      .refine((n) => Math.abs(n) < 10 ** 15, dict.validation.amountTooLarge),
    interest_rate: z.coerce.number().min(0).nullable().optional(),
    minimum_payment: z.coerce.number().min(0).nullable().optional(),
    due_date: z.string().nullable().optional(),
    include_in_net_worth: z.boolean().default(true),
    notes: z.string().trim().max(1000, dict.validation.notesTooLong).optional().or(z.literal("")),
  });
}

export type LiabilityFormValues = z.infer<ReturnType<typeof buildLiabilitySchema>>;

export function buildUpdateLiabilitySchema(dict: Dictionary) {
  return buildLiabilitySchema(dict).partial();
}
