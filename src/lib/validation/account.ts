import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export const ACCOUNT_TYPES = [
  "cash",
  "bank",
  "savings",
  "e_wallet",
  "credit_card",
  "investment",
  "other",
] as const;

export function buildAccountSchema(dict: Dictionary) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, dict.validation.accountNameRequired)
      .max(80, dict.validation.accountNameTooLong),
    account_type: z.enum(ACCOUNT_TYPES, {
      message: dict.validation.chooseValidAccountType,
    }),
    institution: z
      .string()
      .trim()
      .max(80, dict.validation.institutionTooLong)
      .optional()
      .or(z.literal("")),
    currency_code: z
      .string()
      .trim()
      .length(3, dict.validation.currencyCodeLength)
      .toUpperCase()
      .default("THB"),
    opening_balance: z.coerce
      .number()
      .finite(dict.validation.enterValidAmount)
      .refine((n) => Math.abs(n) < 10 ** 15, dict.validation.amountTooLarge)
      .default(0),
    include_in_net_worth: z.boolean().default(true),
  });
}

export type AccountFormValues = z.infer<ReturnType<typeof buildAccountSchema>>;

export function buildUpdateAccountSchema(dict: Dictionary) {
  return buildAccountSchema(dict).partial().extend({
    is_archived: z.boolean().optional(),
  });
}

export type UpdateAccountFormValues = z.infer<ReturnType<typeof buildUpdateAccountSchema>>;
