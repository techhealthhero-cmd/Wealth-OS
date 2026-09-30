import { z } from "zod";

import { EARN_REASON_CODES } from "@/lib/earn/reason-codes";
import { EARN_STAGES, INCOME_PATH_TYPES } from "@/lib/earn/types";
import { ABILITIES, INCOME_SITUATIONS, PRIORITIES, RESOURCES, WORK_PREFERENCES } from "@/lib/earn/diagnostic";
import { EXPERIMENT_DECISIONS } from "@/lib/earn/mission-templates";

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

// ---------------------------------------------------------------------------
// Earn V2 — diagnostic answers, path creation, mission results
// ---------------------------------------------------------------------------

/**
 * Full diagnostic answer set. Extends (never replaces) the foundation's
 * `assessmentAnswersSchema`, so every stored snapshot still satisfies it.
 */
export const diagnosticAnswersSchema = assessmentAnswersSchema.extend({
  incomeSituation: z.enum(INCOME_SITUATIONS),
  monthlyIncomeMinor: z.number().int().min(0).lt(10 ** 13),
  incomeIsSteady: z.boolean().nullable(),
  essentialExpensesMinor: z.number().int().positive().lt(10 ** 13),
  availableResources: z.array(z.enum(RESOURCES)).max(RESOURCES.length),
  workPreferences: z.array(z.enum(WORK_PREFERENCES)).min(1).max(WORK_PREFERENCES.length),
  existingAbilities: z.array(z.enum(ABILITIES)).min(1).max(ABILITIES.length),
  availableHoursPerWeek: z.number().min(0).max(168),
  startingCapitalMinor: z.number().int().min(0).lt(10 ** 13),
  currentPriority: z.enum(PRIORITIES),
});

export const createIncomePathSchema = z.object({
  pathType: z.enum(INCOME_PATH_TYPES),
  title: z.string().trim().min(1).max(100),
  /** Recommended experiment the path starts from, if any (catalog key). */
  experimentKey: z.string().trim().max(60).nullable().optional(),
});

export const missionResultSchema = z.object({
  missionId: z.string().uuid(),
  counts: z.record(z.string().max(40), z.number().int().min(0).max(100_000)),
  decision: z.enum(EXPERIMENT_DECISIONS).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  /** Optional: attach this result as evidence to one of the user's skills. */
  skillId: z.string().uuid().nullable().optional(),
});
