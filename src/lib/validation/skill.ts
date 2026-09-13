import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export const SKILL_CATEGORIES = [
  "web_development",
  "design",
  "sales",
  "marketing",
  "fitness",
  "teaching",
  "translation",
  "video_editing",
  "photography",
  "accounting",
  "writing",
  "customer_service",
  "other",
] as const;

export const PROFICIENCY_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
export const INTEREST_LEVELS = ["low", "medium", "high"] as const;

export function buildSkillSchema(dict: Dictionary) {
  return z.object({
    skill_name: z
      .string()
      .trim()
      .min(1, dict.validation.accountNameRequired)
      .max(80, dict.validation.accountNameTooLong),
    category: z.enum(SKILL_CATEGORIES, { message: dict.validation.chooseValidAccountType }),
    proficiency_level: z.enum(PROFICIENCY_LEVELS).default("beginner"),
    experience_months: z.coerce.number().int().min(0).max(1200).nullable().optional(),
    monetized_before: z.coerce.boolean().default(false),
    notes: z.string().trim().max(500).nullable().optional(),
    interest_level: z.enum(INTEREST_LEVELS).default("medium"),
    available_hours_per_week: z.coerce.number().min(0).max(168).nullable().optional(),
  });
}

export type SkillFormValues = z.infer<ReturnType<typeof buildSkillSchema>>;

export function buildUpdateSkillSchema(dict: Dictionary) {
  return buildSkillSchema(dict).partial();
}
