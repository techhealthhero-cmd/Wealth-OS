import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export const ASSET_TYPES = [
  "cash",
  "bank",
  "savings",
  "investment",
  "gold",
  "crypto",
  "property",
  "vehicle",
  "business",
  "other",
] as const;

export function buildAssetSchema(dict: Dictionary) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, dict.validation.accountNameRequired)
      .max(80, dict.validation.accountNameTooLong),
    asset_type: z.enum(ASSET_TYPES, { message: dict.validation.chooseValidAccountType }),
    value: z.coerce
      .number()
      .finite(dict.validation.enterValidAmount)
      .min(0, dict.validation.enterValidAmount)
      .refine((n) => Math.abs(n) < 10 ** 15, dict.validation.amountTooLarge),
    currency_code: z
      .string()
      .trim()
      .length(3, dict.validation.currencyCodeLength)
      .toUpperCase()
      .default("THB"),
    include_in_net_worth: z.boolean().default(true),
    linked_account_id: z.string().uuid().nullable().optional(),
    notes: z.string().trim().max(1000, dict.validation.notesTooLong).optional().or(z.literal("")),
  });
}

export type AssetFormValues = z.infer<ReturnType<typeof buildAssetSchema>>;

export function buildUpdateAssetSchema(dict: Dictionary) {
  return buildAssetSchema(dict).partial();
}
