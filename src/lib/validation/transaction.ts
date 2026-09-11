import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export const TRANSACTION_TYPES = [
  "income",
  "expense",
  "refund",
  "debt_payment",
  "savings_transfer",
  "investment_allocation",
] as const;

function buildAmountSchema(dict: Dictionary) {
  return z.coerce
    .number({ message: dict.validation.amountRequired })
    .positive(dict.validation.amountRequired)
    .refine((n) => Math.abs(n) < 10 ** 15, dict.validation.amountTooLarge)
    .refine((n) => Math.round(n * 100) === n * 100, dict.validation.amountDecimalPlaces);
}

/** Covers every transaction type except 'transfer', which has its own schema/RPC. */
export function buildTransactionSchema(dict: Dictionary) {
  return z.object({
    type: z.enum(TRANSACTION_TYPES),
    account_id: z.string().uuid(dict.validation.selectAccount),
    category_id: z.string().uuid().nullable().optional(),
    amount: buildAmountSchema(dict),
    transaction_date: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), dict.validation.selectValidDate),
    description: z
      .string()
      .trim()
      .max(200, dict.validation.descriptionTooLong)
      .optional()
      .or(z.literal("")),
    merchant: z
      .string()
      .trim()
      .max(120, dict.validation.textTooLong)
      .optional()
      .or(z.literal("")),
    notes: z
      .string()
      .trim()
      .max(1000, dict.validation.notesTooLong)
      .optional()
      .or(z.literal("")),
    is_recurring: z.boolean().default(false),
  });
}

export type TransactionFormValues = z.infer<ReturnType<typeof buildTransactionSchema>>;

export function buildTransferSchema(dict: Dictionary) {
  return z
    .object({
      from_account_id: z.string().uuid(dict.validation.selectFromAccount),
      to_account_id: z.string().uuid(dict.validation.selectToAccount),
      amount: buildAmountSchema(dict),
      transaction_date: z
        .string()
        .refine((v) => !Number.isNaN(Date.parse(v)), dict.validation.selectValidDate),
      description: z
        .string()
        .trim()
        .max(200, dict.validation.descriptionTooLong)
        .optional()
        .or(z.literal("")),
      notes: z
        .string()
        .trim()
        .max(1000, dict.validation.notesTooLong)
        .optional()
        .or(z.literal("")),
    })
    .refine((data) => data.from_account_id !== data.to_account_id, {
      message: dict.validation.sameAccountTransfer,
      path: ["to_account_id"],
    });
}

export type TransferFormValues = z.infer<ReturnType<typeof buildTransferSchema>>;

export function buildUpdateTransactionSchema(dict: Dictionary) {
  return buildTransactionSchema(dict).partial();
}

export type UpdateTransactionFormValues = z.infer<ReturnType<typeof buildUpdateTransactionSchema>>;
