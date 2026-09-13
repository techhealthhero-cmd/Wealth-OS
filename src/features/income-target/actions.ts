"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildIncomeTargetSchema } from "@/lib/validation/income-target";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseIncomeTargetFormData(formData: FormData) {
  return {
    target_monthly_income: formData.get("target_monthly_income") || null,
    desired_extra_income: formData.get("desired_extra_income") || null,
    target_date: formData.get("target_date") || null,
    preferred_income_type: formData.get("preferred_income_type") || undefined,
    max_hours_per_week: formData.get("max_hours_per_week") || null,
    max_startup_cost: formData.get("max_startup_cost") || null,
    work_mode_preference: formData.get("work_mode_preference") || undefined,
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

/** Create-or-update in one action: at most one income target row per user (unique(user_id)). */
export async function saveIncomeTarget(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildIncomeTargetSchema(dict).safeParse(parseIncomeTargetFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("income_targets")
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: "user_id" });

  if (error) return { error: friendlyDbError(error, "saveIncomeTarget", dict.earn.target.saveFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/income");
  revalidatePath("/earn/opportunities");
  return { success: true };
}
