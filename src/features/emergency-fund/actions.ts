"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildEmergencyFundSchema } from "@/lib/validation/emergency-fund";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseEmergencyFundFormData(formData: FormData) {
  return {
    target_months: formData.get("target_months") || null,
    custom_target_amount: formData.get("custom_target_amount") || null,
    current_amount: formData.get("current_amount") ?? 0,
    monthly_contribution: formData.get("monthly_contribution") ?? 0,
    linked_account_id: formData.get("linked_account_id") || null,
    linked_goal_id: formData.get("linked_goal_id") || null,
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

/** Create-or-update in one action: at most one emergency fund row per user (unique(user_id)). */
export async function saveEmergencyFund(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildEmergencyFundSchema(dict).safeParse(parseEmergencyFundFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("emergency_funds")
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: "user_id" });

  if (error) return { error: friendlyDbError(error, "saveEmergencyFund", dict.emergencyFund.createFailed) };

  revalidatePath("/plan/emergency-fund");
  revalidatePath("/dashboard");
  return { success: true };
}
