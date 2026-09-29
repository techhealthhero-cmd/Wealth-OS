import { z } from "zod";

export const accountPrivacyDisplayStyleSchema = z.enum(["blur", "unavailable", "empty", "custom"]);
export const accountPrivacyPinSchema = z.string().regex(/^\d{6}$/);

export const accountPrivacySettingsSchema = z.object({
  enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
  protectAccounts: z.enum(["true", "false"]).transform((value) => value === "true"),
  protectAssets: z.enum(["true", "false"]).transform((value) => value === "true"),
  displayStyle: accountPrivacyDisplayStyleSchema,
  customMessage: z.string().trim().max(80).optional().transform((value) => value || null),
  pin: z.string(),
  pinConfirmation: z.string().optional(),
});
export const accountPrivacyUnlockSchema = z.object({
  pin: accountPrivacyPinSchema,
});
