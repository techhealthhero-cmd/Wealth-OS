import { z } from "zod";

export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name is too long"),
  preferred_language: z.enum(["th", "en"]).default("th"),
  currency_code: z
    .string()
    .trim()
    .length(3, "Currency code must be 3 letters")
    .toUpperCase()
    .default("THB"),
  timezone: z.string().trim().min(1).default("Asia/Bangkok"),
});

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
