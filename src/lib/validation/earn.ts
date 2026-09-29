import { z } from "zod";

import { EARN_REASON_CODES } from "@/lib/earn/reason-codes";
import { EARN_STAGES, INCOME_PATH_TYPES } from "@/lib/earn/types";

const currencyCodeSchema = z.string().trim().regex(/^[A-Z]{3}$/);

export const assessmentAnswersSchema = z.object({
  incomeSituation: z.enum(["none", "irregular", "salary", "freelance", "business", "investment"]),
  availableResources: z.array(z.string().trim().min(1).max(60)).max(20),
  workPreferences: z.array(z.string().trim().min(1).max(60)).max(20),
  existingAbilities: z.array(z.string().trim().min(1).max(80)).max(30),
  availableHoursPerWeek: z.number().min(0).max(168),
  startingCapitalMinor: z.number().int().min(0),
  startingCapitalCurrency: currencyCodeSchema,
  currentPriority: z.string().trim().min(1).max(80),
});

export const earnAssessmentSnapshotSchema = z.object({
  rules_version: z.string().trim().min(1).max(50),
  answers: assessmentAnswersSchema,
  calculated_stage: z.enum(EARN_STAGES),
  reason_codes: z.array(z.enum(EARN_REASON_CODES)).min(1),
  essential_expenses_amount: z.number().min(0),
  essential_expenses_currency: currencyCodeSchema,
  essential_expenses_source: z.enum(["financial_data", "self_report"]),
  completed_at: z.iso.datetime(),
});

export const incomePathSchema = z.object({
  path_type: z.enum(INCOME_PATH_TYPES),
  title: z.string().trim().min(1).max(100),
  status: z.enum(["planned", "active", "paused", "completed", "archived"]).default("planned"),
  roadmap_template_version: z.string().trim().min(1).max(50),
  current_roadmap_step_key: z.string().trim().min(1).max(80).nullable().optional(),
});
