"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-error";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { calculateIncomePlan } from "@/lib/financial/income-plan";
import { centsToDecimalString, parseMoneyToCents } from "@/lib/financial/money";
import { incomePlanSchema } from "@/lib/validation/income-plan";
import type { IncomePlan } from "@/types/database";

export interface IncomePlanActionState {
  error?: string;
  success?: boolean;
}

async function getRequestContext() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  return { supabase, dict: getDictionary(locale) };
}

export async function createIncomePlan(
  _previous: IncomePlanActionState | undefined,
  formData: FormData
): Promise<IncomePlanActionState> {
  const { supabase, dict } = await getRequestContext();
  const parsed = incomePlanSchema.safeParse({
    skill_id: formData.get("skill_id") || null,
    interest_name: formData.get("interest_name"),
    offer_name: formData.get("offer_name"),
    category: formData.get("category") || "other",
    earning_unit: formData.get("earning_unit"),
    rate_per_unit: formData.get("rate_per_unit"),
    units_per_week: formData.get("units_per_week"),
    hours_per_unit: formData.get("hours_per_unit"),
    active_weeks_per_year: formData.get("active_weeks_per_year"),
    growth_focus: formData.get("growth_focus"),
  });
  if (!parsed.success) return { error: dict.earn.planner.invalidPlan };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("income_plans").insert({
    ...parsed.data,
    user_id: user.id,
  });
  if (error) return { error: friendlyDbError(error, "createIncomePlan", dict.earn.planner.saveFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/income");
  return { success: true };
}

export async function activateIncomePlan(planId: string): Promise<void> {
  const { supabase, dict } = await getRequestContext();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error(dict.common.pleaseLogin);

  const { data, error: loadError } = await supabase
    .from("income_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (loadError) {
    throw new Error(friendlyDbError(loadError, "activateIncomePlan.load", dict.earn.planner.activateFailed));
  }
  if (!data) throw new Error(dict.earn.planner.activateFailed);
  const plan = data as IncomePlan;
  if (plan.income_source_id) return;

  const projection = calculateIncomePlan({
    ratePerUnitCents: parseMoneyToCents(plan.rate_per_unit),
    unitsPerWeek: Number(plan.units_per_week),
    hoursPerUnit: Number(plan.hours_per_unit),
    activeWeeksPerYear: plan.active_weeks_per_year,
  });
  const { data: source, error: sourceError } = await supabase
    .from("income_sources")
    .insert({
      user_id: user.id,
      name: plan.offer_name,
      source_type: "side_hustle",
      expected_monthly_income: centsToDecimalString(projection.monthlyIncomeCents),
      stability: "variable",
      frequency: "monthly",
      is_active: true,
      notes: `${dict.earn.planner.createdFromPlan}: ${plan.interest_name}`,
    })
    .select("id")
    .single();
  if (sourceError) {
    throw new Error(friendlyDbError(sourceError, "activateIncomePlan.source", dict.earn.planner.activateFailed));
  }
  if (!source) throw new Error(dict.earn.planner.activateFailed);

  const { error: updateError } = await supabase
    .from("income_plans")
    .update({ income_source_id: source.id })
    .eq("id", planId)
    .eq("user_id", user.id);
  if (updateError) throw new Error(friendlyDbError(updateError, "activateIncomePlan.update", dict.earn.planner.activateFailed));

  revalidatePath("/earn");
  revalidatePath("/earn/income");
}

export async function deleteIncomePlan(planId: string): Promise<void> {
  const { supabase, dict } = await getRequestContext();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error(dict.common.pleaseLogin);

  const { error } = await supabase.from("income_plans").delete().eq("id", planId).eq("user_id", user.id);
  if (error) throw new Error(friendlyDbError(error, "deleteIncomePlan", dict.earn.planner.deleteFailed));
  revalidatePath("/earn/income");
}
