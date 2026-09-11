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
  monthly_income: z.coerce.number().nonnegative().optional(),
  starting_balance: z.coerce.number().optional(),
  monthly_essential_expenses: z.coerce.number().nonnegative().optional(),
  primary_goal: z
    .enum(["save_more", "pay_off_debt", "build_wealth", "track_spending", "other"])
    .optional(),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
