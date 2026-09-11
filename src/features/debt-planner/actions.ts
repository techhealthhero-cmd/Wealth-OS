"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildDebtPlanSchema } from "@/lib/validation/debt-plan";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

export async function saveDebtPlan(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildDebtPlanSchema(dict).safeParse({
    strategy: formData.get("strategy"),
    extra_monthly_payment: formData.get("extra_monthly_payment") ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("debt_plans")
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: "user_id" });
  if (error) return { error: friendlyDbError(error, "saveDebtPlan", dict.debtPlanner.saveFailed) };

  revalidatePath("/plan/debt");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function saveCustomPriorityOrder(orderedLiabilityIds: string[]): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { data: plan, error: planError } = await supabase
    .from("debt_plans")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (planError || !plan) return { error: dict.debtPlanner.saveFailed };

  await supabase.from("debt_plan_priorities").delete().eq("debt_plan_id", plan.id);

  const rows = orderedLiabilityIds.map((liabilityId, index) => ({
    debt_plan_id: plan.id,
    liability_id: liabilityId,
    priority_order: index + 1,
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("debt_plan_priorities").insert(rows);
    if (error) return { error: friendlyDbError(error, "saveCustomPriorityOrder", dict.debtPlanner.saveFailed) };
  }

  revalidatePath("/plan/debt");
  return { success: true };
}
