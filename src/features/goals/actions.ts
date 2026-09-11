"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildGoalSchema, buildUpdateGoalSchema } from "@/lib/validation/goal";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseGoalFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    goal_type: formData.get("goal_type"),
    target_amount: formData.get("target_amount"),
    current_amount: formData.get("current_amount") ?? 0,
    target_date: formData.get("target_date") || null,
    priority: formData.get("priority") || undefined,
    monthly_contribution: formData.get("monthly_contribution") ?? 0,
    linked_account_id: formData.get("linked_account_id") || null,
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

export async function createGoal(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildGoalSchema(dict).safeParse(parseGoalFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("financial_goals").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) return { error: friendlyDbError(error, "createGoal", dict.goals.createFailed) };

  revalidatePath("/plan/goals");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateGoal(
  goalId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildUpdateGoalSchema(dict).safeParse(parseGoalFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("financial_goals")
    .update(parsed.data)
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (error) return { error: friendlyDbError(error, "updateGoal", dict.goals.updateFailed) };

  revalidatePath("/plan/goals");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function archiveGoal(goalId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("financial_goals")
    .update({ status: "archived" })
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (error) return { error: friendlyDbError(error, "archiveGoal", dict.goals.deleteFailed) };

  revalidatePath("/plan/goals");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteGoal(goalId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("financial_goals").delete().eq("id", goalId).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "deleteGoal", dict.goals.deleteFailed) };

  revalidatePath("/plan/goals");
  revalidatePath("/dashboard");
  return { success: true };
}
