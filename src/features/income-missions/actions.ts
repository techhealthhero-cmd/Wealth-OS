"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { generateMissionSequence } from "@/lib/financial/income-missions";
import type { MissionStatus } from "@/types/database";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

/**
 * Generates the canonical mission sequence for a chosen opportunity — pure
 * template data (src/lib/financial/income-missions.ts), never AI-invented.
 * A no-op if the user already has missions tied to this opportunity, so
 * re-clicking "start" never duplicates a sequence.
 */
export async function generateMissionsForOpportunity(opportunityId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { data: existing, error: existingError } = await supabase
    .from("income_missions")
    .select("id")
    .eq("user_id", user.id)
    .eq("related_opportunity_id", opportunityId)
    .limit(1);
  if (existingError) return { error: friendlyDbError(existingError, "generateMissionsForOpportunity", dict.earn.missions.saveFailed) };
  if (existing && existing.length > 0) return { success: true };

  const templates = generateMissionSequence();
  const rows = templates.map((template) => ({
    user_id: user.id,
    related_opportunity_id: opportunityId,
    title: template.missionType,
    mission_type: template.missionType,
    target_quantity: template.targetQuantity,
    estimated_minutes: template.estimatedMinutes,
    impact_level: template.impactLevel,
    sequence_order: template.sequenceOrder,
    status: "not_started" as const,
  }));

  const { error } = await supabase.from("income_missions").insert(rows);
  if (error) return { error: friendlyDbError(error, "generateMissionsForOpportunity", dict.earn.missions.saveFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/missions");
  return { success: true };
}

export async function updateMissionStatus(missionId: string, status: MissionStatus): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("income_missions")
    .update({ status })
    .eq("id", missionId)
    .eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "updateMissionStatus", dict.earn.missions.saveFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/missions");
  return { success: true };
}

/** Bumps progress toward a mission's target quantity; auto-completes once the target is reached. Never lets AI or any caller mark progress beyond what's explicitly requested here. */
export async function incrementMissionProgress(missionId: string, targetQuantity: number | null): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { data: mission, error: fetchError } = await supabase
    .from("income_missions")
    .select("progress_quantity")
    .eq("id", missionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchError || !mission) return { error: friendlyDbError(fetchError ?? { message: "not found" }, "incrementMissionProgress", dict.earn.missions.saveFailed) };

  const nextProgress = Number(mission.progress_quantity) + 1;
  const status: MissionStatus = targetQuantity !== null && nextProgress >= targetQuantity ? "completed" : "in_progress";

  const { error } = await supabase
    .from("income_missions")
    .update({ progress_quantity: nextProgress, status })
    .eq("id", missionId)
    .eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "incrementMissionProgress", dict.earn.missions.saveFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/missions");
  return { success: true };
}
