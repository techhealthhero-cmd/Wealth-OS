"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildSkillSchema, buildUpdateSkillSchema } from "@/lib/validation/skill";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseSkillFormData(formData: FormData) {
  return {
    skill_name: formData.get("skill_name"),
    category: formData.get("category"),
    proficiency_level: formData.get("proficiency_level") || undefined,
    experience_months: formData.get("experience_months") || null,
    monetized_before: formData.get("monetized_before") === "on" || formData.get("monetized_before") === "true",
    notes: formData.get("notes") || null,
    interest_level: formData.get("interest_level") || undefined,
    available_hours_per_week: formData.get("available_hours_per_week") || null,
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

export async function createSkill(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildSkillSchema(dict).safeParse(parseSkillFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("user_skills").insert({ ...parsed.data, user_id: user.id });
  if (error) return { error: friendlyDbError(error, "createSkill", dict.earn.skills.saveFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/skills");
  revalidatePath("/earn/opportunities");
  return { success: true };
}

export async function updateSkill(
  skillId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildUpdateSkillSchema(dict).safeParse(parseSkillFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("user_skills").update(parsed.data).eq("id", skillId).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "updateSkill", dict.earn.skills.saveFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/skills");
  revalidatePath("/earn/opportunities");
  return { success: true };
}

export async function deleteSkill(skillId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("user_skills").delete().eq("id", skillId).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "deleteSkill", dict.earn.skills.deleteFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/skills");
  revalidatePath("/earn/opportunities");
  return { success: true };
}
