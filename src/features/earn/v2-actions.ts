"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { friendlyDbError } from "@/lib/db-error";
import { centsToDecimalString } from "@/lib/financial/money";
import { todayInTimeZone } from "@/lib/date";
import { awardXpOnce } from "@/features/engagement/xp";
import { getIncomeMissionXpReward } from "@/lib/skills/income-rank";
import { deriveStageFacts, DIAGNOSTIC_RULES_VERSION } from "@/lib/earn/diagnostic";
import { calculateEarnStage, EARN_STAGE_RULES } from "@/lib/earn/stage";
import { getNextRoadmapStepKey, getRoadmapTemplate, ROADMAP_TEMPLATES_VERSION } from "@/lib/earn/roadmap";
import { getMissionTemplate, resultHasPositiveOutcome, validateMissionResult } from "@/lib/earn/mission-templates";
import { createIncomePathSchema, diagnosticAnswersSchema, missionResultSchema } from "@/lib/validation/earn";
import { getEmergencyFundMinor, isMissingRelation } from "@/features/earn/v2-queries";
import type { IncomePathType } from "@/lib/earn/types";
import type { DiagnosticAnswers } from "@/lib/earn/diagnostic";

/**
 * Earn V2 write side. Every action re-checks the session and scopes every
 * write to `user.id` (RLS enforces the same again, including parent
 * ownership). Real money is only ever written through the existing
 * transactions table (record_earn_income RPC, migration 0031).
 */

export interface EarnActionResult {
  success?: boolean;
  error?: string;
  id?: string;
}

async function context() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return { dict: getDictionary(locale), timezone: profile?.timezone ?? "Asia/Bangkok" };
}

function revalidateEarn(pathId?: string | null) {
  revalidatePath("/earn");
  revalidatePath("/earn/paths");
  revalidatePath("/earn/missions");
  if (pathId) revalidatePath(`/earn/paths/${pathId}`);
}

// ---------------------------------------------------------------------------
// diagnostic
// ---------------------------------------------------------------------------

/**
 * Stores a completed diagnostic as a NEW immutable snapshot (reassessment
 * never overwrites history — the table has no update policy). The stage is
 * computed here on the server from the answers, never taken from the client.
 */
export async function submitDiagnostic(answers: DiagnosticAnswers): Promise<EarnActionResult> {
  const { dict } = await context();
  const parsed = diagnosticAnswersSchema.safeParse(answers);
  if (!parsed.success) return { error: dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const a = parsed.data;
  const stage = calculateEarnStage(deriveStageFacts(a, await getEmergencyFundMinor()));
  const { data, error } = await supabase
    .from("earn_assessments")
    .insert({
      user_id: user.id,
      rules_version: `${DIAGNOSTIC_RULES_VERSION}+${EARN_STAGE_RULES.version}`,
      answers: a,
      calculated_stage: stage.stage,
      reason_codes: stage.reasonCodes,
      essential_expenses_amount: Number(centsToDecimalString(a.essentialExpensesMinor)),
      essential_expenses_currency: a.startingCapitalCurrency,
      essential_expenses_source: "self_report",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { error: friendlyDbError(error ?? { message: "insert" }, "submitDiagnostic", dict.earn.v2.diagnostic.saveFailed) };

  revalidateEarn();
  return { success: true, id: data.id };
}

// ---------------------------------------------------------------------------
// paths + roadmap
// ---------------------------------------------------------------------------

type Client = Awaited<ReturnType<typeof createClient>>;

/** Creates the one mission for a roadmap step, in the user's language. Idempotent per (path, template, project) while one is open. */
async function createStepMission(supabase: Client, dict: Dictionary, userId: string, pathId: string, pathType: IncomePathType, stepKey: string) {
  const template = getMissionTemplate(pathType, stepKey);
  if (!template) return;
  const { data: existing } = await supabase
    .from("income_missions")
    .select("id")
    .eq("income_path_id", pathId)
    .eq("roadmap_step_key", stepKey)
    .in("status", ["not_started", "in_progress"])
    .limit(1);
  if (existing?.length) return;

  const copy = (dict.earn.v2.missions as unknown as Record<string, Record<string, { title: string; description: string }>>)[pathType]?.[stepKey];
  const order = getRoadmapTemplate(pathType).steps.find((s) => s.key === stepKey)?.order ?? 0;
  const row = {
    user_id: userId,
    title: copy?.title ?? stepKey,
    description: copy?.description ?? null,
    mission_type: "other",
    target_quantity: template.targetQuantity,
    status: "not_started",
    sequence_order: order,
    estimated_minutes: template.estimatedMinutes,
    impact_level: template.mayProduceIncome ? "high" : "medium",
    income_path_id: pathId,
    mission_category: template.category,
    roadmap_step_key: stepKey,
    mission_template_key: `${pathType}.${stepKey}`,
    result_required: template.resultRequired,
  };
  let { error } = await supabase.from("income_missions").insert(row);
  // Deploy-safe transition: app code may reach an environment shortly before
  // additive migration 0035. Keep the sequential idempotency guard working
  // there, while the unique index closes concurrent retries after migration.
  if (error?.code === "42703" || error?.code === "PGRST204") {
    const { mission_template_key: _notMigratedYet, ...legacyRow } = row;
    void _notMigratedYet;
    ({ error } = await supabase.from("income_missions").insert(legacyRow));
  }
  if (error && error.code !== "23505") throw error;
}

/** Creates a path, initializes its roadmap at step one and its first mission. */
export async function createIncomePath(input: { pathType: string; title: string; experimentKey?: string | null }): Promise<EarnActionResult> {
  const { dict } = await context();
  const parsed = createIncomePathSchema.safeParse(input);
  if (!parsed.success) return { error: dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const firstStep = getRoadmapTemplate(parsed.data.pathType).steps[0].key;
  const { data, error } = await supabase
    .from("income_paths")
    .insert({
      user_id: user.id,
      path_type: parsed.data.pathType,
      title: parsed.data.title,
      status: "active",
      roadmap_template_version: ROADMAP_TEMPLATES_VERSION,
      current_roadmap_step_key: firstStep,
      initialized_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { error: friendlyDbError(error ?? { message: "insert" }, "createIncomePath", dict.earn.v2.paths.createFailed) };

  await createStepMission(supabase, dict, user.id, data.id, parsed.data.pathType, firstStep);
  revalidateEarn(data.id);
  return { success: true, id: data.id };
}

/** Moves a path to the step after `fromStepKey` (never skips or rewinds) and opens its mission. */
async function advancePath(supabase: Client, dict: Dictionary, userId: string, pathId: string, fromStepKey: string) {
  const { data: path } = await supabase
    .from("income_paths")
    .select("id, path_type, current_roadmap_step_key")
    .eq("id", pathId)
    .eq("user_id", userId)
    .maybeSingle();
  // Only advance if the path is still on the step this mission belongs to —
  // a stale/duplicate completion must not jump the roadmap twice.
  if (!path || path.current_roadmap_step_key !== fromStepKey) return;
  const next = getNextRoadmapStepKey(path.path_type as IncomePathType, fromStepKey);
  if (!next) {
    await supabase.from("income_paths").update({ status: "completed", current_roadmap_step_key: null }).eq("id", pathId).eq("user_id", userId);
    return;
  }
  await supabase.from("income_paths").update({ current_roadmap_step_key: next }).eq("id", pathId).eq("user_id", userId);
  await createStepMission(supabase, dict, userId, pathId, path.path_type as IncomePathType, next);
}

export async function setIncomePathStatus(pathId: string, status: "active" | "paused"): Promise<EarnActionResult> {
  const { dict } = await context();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };
  const { error } = await supabase.from("income_paths").update({ status }).eq("id", pathId).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "setIncomePathStatus", dict.earn.v2.missions.failed) };
  revalidateEarn(pathId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// missions + results
// ---------------------------------------------------------------------------

/**
 * Marks a mission done. A mission that needs a result waits for it before
 * the roadmap moves on; one that doesn't advances the path right away. XP
 * is awarded once per mission (existing ledger), and never drives stage.
 */
export async function completeEarnMission(missionId: string): Promise<EarnActionResult> {
  const { dict } = await context();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { data: mission, error: missionError } = await supabase
    .from("income_missions")
    .select("id, status, mission_type, income_path_id, roadmap_step_key, result_required")
    .eq("id", missionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (missionError) return { error: friendlyDbError(missionError, "completeEarnMission.read", dict.earn.v2.missions.failed) };
  // Legacy (non-path) missions keep their own lifecycle in income-missions/actions.ts.
  if (!mission || !mission.income_path_id) return { error: dict.earn.v2.missions.notFound };

  if (mission.status !== "completed") {
    const { error } = await supabase
      .from("income_missions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", missionId)
      .eq("user_id", user.id);
    if (error) return { error: friendlyDbError(error, "completeEarnMission", dict.earn.v2.missions.failed) };
    await awardXpOnce(user.id, "income_mission_completed", missionId, getIncomeMissionXpReward(mission.mission_type));
  }

  if (!mission.result_required && mission.income_path_id && mission.roadmap_step_key) {
    await advancePath(supabase, dict, user.id, mission.income_path_id, mission.roadmap_step_key);
  }
  revalidateEarn(mission.income_path_id);
  return { success: true };
}

/**
 * Records what actually happened. Validated against the step's template
 * (known fields, whole numbers, funnel never widens); the system never fills
 * a number in. The decision drives the roadmap: continue → next step,
 * adjust → a fresh try of the same step, pause/switch → the path pauses.
 * Optionally adds skill evidence (outcome if the funnel's last stage > 0,
 * else action).
 */
export async function recordEarnMissionResult(input: {
  missionId: string;
  counts: Record<string, number>;
  decision: "continue" | "adjust" | "pause" | "switch" | null;
  notes: string | null;
  skillId?: string | null;
}): Promise<EarnActionResult> {
  const { dict } = await context();
  const parsed = missionResultSchema.safeParse(input);
  if (!parsed.success) return { error: dict.common.invalidInput };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { data: mission, error: missionError } = await supabase
    .from("income_missions")
    .select("id, status, mission_type, income_path_id, roadmap_step_key")
    .eq("id", d.missionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (missionError) return { error: friendlyDbError(missionError, "recordEarnMissionResult.mission", dict.earn.v2.missions.failed) };
  if (!mission || !mission.income_path_id || !mission.roadmap_step_key) return { error: dict.earn.v2.missions.notFound };
  const { data: path, error: pathError } = await supabase
    .from("income_paths")
    .select("id, path_type")
    .eq("id", mission.income_path_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (pathError) return { error: friendlyDbError(pathError, "recordEarnMissionResult.path", dict.earn.v2.missions.failed) };
  if (!path) return { error: dict.earn.v2.missions.notFound };

  const template = getMissionTemplate(path.path_type as IncomePathType, mission.roadmap_step_key);
  if (!template) return { error: dict.earn.v2.missions.notFound };
  const invalid = validateMissionResult(template, { counts: d.counts, decision: d.decision, notes: d.notes });
  if (invalid) return { error: dict.earn.v2.missions.result.errors[invalid] };

  const { error } = await supabase.from("income_mission_results").upsert(
    {
      user_id: user.id,
      income_mission_id: mission.id,
      outcome_data: { counts: d.counts, decision: d.decision, template: `${path.path_type}.${template.stepKey}` },
      notes: d.notes || null,
      recorded_at: new Date().toISOString(),
    },
    { onConflict: "income_mission_id" }
  );
  if (error) return { error: friendlyDbError(error, "recordEarnMissionResult", dict.earn.v2.missions.failed) };

  if (mission.status !== "completed") {
    await supabase
      .from("income_missions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", mission.id)
      .eq("user_id", user.id);
    await awardXpOnce(user.id, "income_mission_completed", mission.id, getIncomeMissionXpReward(mission.mission_type));
  }

  if (d.skillId) {
    // RLS re-checks that the skill, path and mission all belong to this user.
    await supabase.from("skill_evidence").insert({
      user_id: user.id,
      user_skill_id: d.skillId,
      income_path_id: path.id,
      income_mission_id: mission.id,
      dimension: resultHasPositiveOutcome(template, d.counts) ? "outcome" : "action",
      evidence_type: `mission_result:${template.stepKey}`,
      description: d.notes || null,
      metadata: { counts: d.counts },
    });
  }

  const decision = d.decision ?? "continue";
  if (decision === "continue") {
    await advancePath(supabase, dict, user.id, path.id, template.stepKey);
  } else if (decision === "adjust") {
    await createStepMission(supabase, dict, user.id, path.id, path.path_type as IncomePathType, template.stepKey);
  } else {
    await supabase.from("income_paths").update({ status: "paused" }).eq("id", path.id).eq("user_id", user.id);
  }

  revalidateEarn(path.id);
  return { success: true, id: path.id };
}

// ---------------------------------------------------------------------------
// projects + real income
// ---------------------------------------------------------------------------

export async function createEarnProject(input: { pathId: string; title: string }): Promise<EarnActionResult> {
  const { dict } = await context();
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 120) return { error: dict.common.invalidInput };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };
  const { data, error } = await supabase
    .from("earn_projects")
    .insert({ user_id: user.id, income_path_id: input.pathId, title })
    .select("id")
    .single();
  if (error || !data) {
    if (isMissingRelation(error)) return { error: dict.earn.v2.income.migrationPending };
    return { error: friendlyDbError(error ?? { message: "insert" }, "createEarnProject", dict.earn.v2.projects.failed) };
  }
  revalidateEarn(input.pathId);
  return { success: true, id: data.id };
}

export async function setEarnProjectStatus(
  projectId: string,
  status: "active" | "completed" | "archived"
): Promise<EarnActionResult> {
  const { dict } = await context();
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !["active", "completed", "archived"].includes(status)) {
    return { error: dict.common.invalidInput };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };
  const { data: project, error: readError } = await supabase
    .from("earn_projects")
    .select("id, income_path_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError || !project) return { error: friendlyDbError(readError ?? { message: "not found" }, "setEarnProjectStatus.read", dict.earn.v2.projects.failed) };
  const { error } = await supabase.from("earn_projects").update({ status }).eq("id", project.id).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "setEarnProjectStatus", dict.earn.v2.projects.failed) };
  revalidateEarn(project.income_path_id);
  return { success: true };
}

/** Link a V2 mission to an optional project from the same income path. */
export async function assignEarnMissionProject(missionId: string, projectId: string | null): Promise<EarnActionResult> {
  const { dict } = await context();
  if (!/^[0-9a-f-]{36}$/i.test(missionId) || (projectId !== null && !/^[0-9a-f-]{36}$/i.test(projectId))) {
    return { error: dict.common.invalidInput };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };
  const { data: mission, error: missionError } = await supabase
    .from("income_missions")
    .select("id, income_path_id")
    .eq("id", missionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (missionError || !mission?.income_path_id) return { error: dict.earn.v2.missions.notFound };
  if (projectId) {
    const { data: project, error: projectError } = await supabase
      .from("earn_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .eq("income_path_id", mission.income_path_id)
      .maybeSingle();
    if (projectError || !project) return { error: dict.common.invalidInput };
  }
  const { error } = await supabase
    .from("income_missions")
    .update({ earn_project_id: projectId })
    .eq("id", mission.id)
    .eq("user_id", user.id);
  if (error) {
    if (isMissingRelation(error) || error.code === "42703") return { error: dict.earn.v2.projects.migrationPending };
    return { error: friendlyDbError(error, "assignEarnMissionProject", dict.earn.v2.projects.failed) };
  }
  revalidateEarn(mission.income_path_id);
  revalidatePath(`/earn/missions/${mission.id}`);
  return { success: true };
}

/**
 * "I got paid from this path": one call to record_earn_income, which
 * creates the real income transaction (balances, dashboards, net worth all
 * update through the existing ledger) and its Earn link atomically, with
 * the same client_request_id idempotency as every other money write.
 */
export async function recordEarnIncome(input: {
  pathId: string;
  projectId: string | null;
  accountId: string;
  categoryId: string | null;
  amountCents: number;
  date: string;
  description: string | null;
  clientRequestId: string;
}): Promise<EarnActionResult> {
  const { dict, timezone } = await context();
  if (
    !Number.isInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents >= 10 ** 15 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date > todayInTimeZone(timezone) ||
    !/^[0-9a-f-]{36}$/i.test(input.clientRequestId)
  ) {
    return { error: dict.common.invalidInput };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  if (input.categoryId) {
    const { data: category, error: categoryError } = await supabase.from("categories").select("type").eq("id", input.categoryId).maybeSingle();
    if (categoryError) return { error: friendlyDbError(categoryError, "recordEarnIncome.category", dict.earn.v2.income.failed) };
    if (!category || (category.type !== "income" && category.type !== "both")) return { error: dict.common.invalidInput };
  }

  const { data, error } = await supabase.rpc("record_earn_income", {
    p_income_path_id: input.pathId,
    p_earn_project_id: input.projectId,
    p_account_id: input.accountId,
    p_category_id: input.categoryId,
    p_amount: Number(centsToDecimalString(input.amountCents)),
    p_transaction_date: input.date,
    p_description: input.description?.trim().slice(0, 200) || null,
    p_client_request_id: input.clientRequestId,
  });
  if (error) {
    if (isMissingRelation(error)) return { error: dict.earn.v2.income.migrationPending };
    return { error: friendlyDbError(error, "recordEarnIncome", dict.earn.v2.income.failed) };
  }

  revalidateEarn(input.pathId);
  revalidatePath("/money/transactions");
  revalidatePath("/dashboard");
  return { success: true, id: data ?? undefined };
}

// ---------------------------------------------------------------------------
// skills V2 — evidence + path links
// ---------------------------------------------------------------------------

/** "I learned something" — the learning dimension of a skill's evidence. */
export async function addLearningEvidence(input: { skillId: string; description: string }): Promise<EarnActionResult> {
  const { dict } = await context();
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(input.skillId) || !description || description.length > 1000) return { error: dict.common.invalidInput };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };
  // RLS (0028) re-checks that the skill belongs to this user.
  const { error } = await supabase.from("skill_evidence").insert({
    user_id: user.id,
    user_skill_id: input.skillId,
    dimension: "learning",
    evidence_type: "self_learning",
    description,
    metadata: {},
  });
  if (error) return { error: friendlyDbError(error, "addLearningEvidence", dict.earn.v2.missions.failed) };
  revalidatePath("/earn/skills");
  return { success: true };
}

/** A skill can support several paths; RLS verifies both belong to the user. */
export async function linkSkillToPath(input: { pathId: string; skillId: string }): Promise<EarnActionResult> {
  const { dict } = await context();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };
  const { error } = await supabase
    .from("income_path_skills")
    .insert({ user_id: user.id, income_path_id: input.pathId, user_skill_id: input.skillId });
  // Already linked (primary key) is fine.
  if (error && error.code !== "23505") return { error: friendlyDbError(error, "linkSkillToPath", dict.earn.v2.missions.failed) };
  revalidatePath(`/earn/paths/${input.pathId}`);
  revalidatePath("/earn/skills");
  return { success: true };
}

export async function unlinkSkillFromPath(input: { pathId: string; skillId: string }): Promise<EarnActionResult> {
  const { dict } = await context();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };
  const { error } = await supabase
    .from("income_path_skills")
    .delete()
    .eq("user_id", user.id)
    .eq("income_path_id", input.pathId)
    .eq("user_skill_id", input.skillId);
  if (error) return { error: friendlyDbError(error, "unlinkSkillFromPath", dict.earn.v2.missions.failed) };
  revalidatePath(`/earn/paths/${input.pathId}`);
  revalidatePath("/earn/skills");
  return { success: true };
}
