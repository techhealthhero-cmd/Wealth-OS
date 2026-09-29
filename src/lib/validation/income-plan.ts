import { z } from "zod";

export const INCOME_PLAN_UNITS = ["hour", "person", "session", "job", "item"] as const;
export const INCOME_PLAN_GROWTH_FOCUSES = ["steady", "more_clients", "raise_rate", "scale"] as const;

export const incomePlanSchema = z.object({
  skill_id: z.string().uuid().nullable().optional(),
  interest_name: z.string().trim().min(1).max(80),
  offer_name: z.string().trim().min(1).max(100),
  category: z.enum([
    "web_development", "design", "sales", "marketing", "fitness", "teaching",
    "translation", "video_editing", "photography", "accounting", "writing",
    "customer_service", "other",
  ]),
  earning_unit: z.enum(INCOME_PLAN_UNITS),
  rate_per_unit: z.coerce.number().positive().max(100000000),
  units_per_week: z.coerce.number().positive().max(1000),
  hours_per_unit: z.coerce.number().positive().max(168),
  active_weeks_per_year: z.coerce.number().int().min(1).max(52),
  growth_focus: z.enum(INCOME_PLAN_GROWTH_FOCUSES),
});
