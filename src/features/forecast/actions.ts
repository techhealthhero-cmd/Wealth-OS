"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildForecastScenarioSchema } from "@/lib/validation/forecast-scenario";
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

function parseScenarioFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    scenario_type: formData.get("scenario_type") || undefined,
    horizon_months: formData.get("horizon_months") ?? 12,
    income_growth_rate: formData.get("income_growth_rate") ?? 0,
    expense_growth_rate: formData.get("expense_growth_rate") ?? 0,
    monthly_savings: formData.get("monthly_savings") ?? 0,
    monthly_investment: formData.get("monthly_investment") ?? 0,
    monthly_debt_payment: formData.get("monthly_debt_payment") ?? 0,
    one_time_income: formData.get("one_time_income") ?? 0,
    one_time_income_month: formData.get("one_time_income_month") || null,
    one_time_expense: formData.get("one_time_expense") ?? 0,
    one_time_expense_month: formData.get("one_time_expense_month") || null,
  };
}

export async function createForecastScenario(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildForecastScenarioSchema(dict).safeParse(parseScenarioFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("forecast_scenarios").insert({ ...parsed.data, user_id: user.id });
  if (error) return { error: friendlyDbError(error, "createForecastScenario", dict.forecast.saveFailed) };

  revalidatePath("/plan/forecast");
  return { success: true };
}

export async function updateForecastScenario(
  scenarioId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildForecastScenarioSchema(dict).partial().safeParse(parseScenarioFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("forecast_scenarios")
    .update(parsed.data)
    .eq("id", scenarioId)
    .eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "updateForecastScenario", dict.forecast.saveFailed) };

  revalidatePath("/plan/forecast");
  return { success: true };
}

export async function deleteForecastScenario(scenarioId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("forecast_scenarios")
    .delete()
    .eq("id", scenarioId)
    .eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "deleteForecastScenario", dict.forecast.deleteFailed) };

  revalidatePath("/plan/forecast");
  return { success: true };
}
