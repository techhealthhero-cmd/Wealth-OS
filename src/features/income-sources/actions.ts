"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildIncomeSourceSchema, buildUpdateIncomeSourceSchema } from "@/lib/validation/income-source";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseIncomeSourceFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    source_type: formData.get("source_type"),
    expected_monthly_income: formData.get("expected_monthly_income") ?? 0,
    stability: formData.get("stability") || undefined,
    frequency: formData.get("frequency") || undefined,
    is_active: formData.get("is_active") === "on" || formData.get("is_active") === "true",
    notes: formData.get("notes") || null,
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

export async function createIncomeSource(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildIncomeSourceSchema(dict).safeParse(parseIncomeSourceFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("income_sources").insert({ ...parsed.data, user_id: user.id });
  if (error) return { error: friendlyDbError(error, "createIncomeSource", dict.earn.income.saveFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/income");
  return { success: true };
}

export async function updateIncomeSource(
  sourceId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildUpdateIncomeSourceSchema(dict).safeParse(parseIncomeSourceFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("income_sources").update(parsed.data).eq("id", sourceId).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "updateIncomeSource", dict.earn.income.saveFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/income");
  return { success: true };
}

export async function deleteIncomeSource(sourceId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("income_sources").delete().eq("id", sourceId).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "deleteIncomeSource", dict.earn.income.deleteFailed) };

  revalidatePath("/earn");
  revalidatePath("/earn/income");
  return { success: true };
}
