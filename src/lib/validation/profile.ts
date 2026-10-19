import { z } from "zod";

import {
  DEFAULT_PROFILE_CURRENCY,
  DEFAULT_PROFILE_TIMEZONE,
  isProfileCurrencyCode,
  isProfileTimezone,
} from "@/lib/validation/profile-options";

/**
 * Values already saved on the user's profile. A legacy value that predates
 * the option lists stays acceptable (only if unchanged), so saving an
 * unrelated field never forces the user off their current setting.
 */
export interface StoredProfileOptions {
  currency_code?: string | null;
  timezone?: string | null;
}

export function createProfileSchema(stored: StoredProfileOptions = {}) {
  return z.object({
    display_name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(80, "Name is too long"),
    preferred_language: z.enum(["th", "en"]).default("th"),
    currency_code: z
      .string()
      .trim()
      .toUpperCase()
      .refine(
        (value) => isProfileCurrencyCode(value) || value === stored.currency_code,
        "Please choose a currency from the list"
      )
      .default(DEFAULT_PROFILE_CURRENCY),
    timezone: z
      .string()
      .trim()
      .refine(
        (value) => isProfileTimezone(value) || value === stored.timezone,
        "Please choose a timezone from the list"
      )
      .default(DEFAULT_PROFILE_TIMEZONE),
  });
}

/** Strict schema: list values only (no legacy allowance). */
export const profileSchema = createProfileSchema();

export type ProfileFormValues = z.infer<typeof profileSchema>;

/** Day-1 onboarding: a subset of profile fields plus optional starting-point figures. */
export const onboardingSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name is too long"),
  starting_balance: z.coerce.number().optional(),
  // Minimum-useful-onboarding pass: `monthly_income`, `monthly_essential_expenses`,
  // and `primary_goal` were previously collected here but never persisted
  // anywhere (see git history) — pure friction with zero value. Removed
  // rather than wired up, since doing either honestly needs more than this
  // one screen can ask without adding real friction back (a goal needs a
  // target amount; income/expense estimates are better derived from real
  // transactions than a one-time guess) — see PRODUCT_OUTCOMES.md's
  // "don't ask for information not required right now."
  starting_account_type: z.enum(["cash", "bank"]).default("cash"),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
