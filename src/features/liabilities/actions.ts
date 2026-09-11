"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildLiabilitySchema, buildUpdateLiabilitySchema } from "@/lib/validation/liability";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseLiabilityFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    liability_type: formData.get("liability_type"),
    balance: formData.get("balance") ?? 0,
    interest_rate: formData.get("interest_rate") || null,
    minimum_payment: formData.get("minimum_payment") || null,
    due_date: formData.get("due_date") || null,
    include_in_net_worth: formData.get("include_in_net_worth") === "on",
    notes: formData.get("notes") || undefined,
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

export async function createLiability(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildLiabilitySchema(dict).safeParse(parseLiabilityFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("liabilities").insert({
    ...parsed.data,
    notes: parsed.data.notes || null,
    user_id: user.id,
  });

  if (error) return { error: friendlyDbError(error, "createLiability", dict.liabilities.createFailed) };

  revalidatePath("/money/liabilities");
  revalidatePath("/money/net-worth");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateLiability(
  liabilityId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildUpdateLiabilitySchema(dict).safeParse(parseLiabilityFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("liabilities")
    .update({ ...parsed.data, notes: parsed.data.notes || null })
    .eq("id", liabilityId)
    .eq("user_id", user.id);

  if (error) return { error: friendlyDbError(error, "updateLiability", dict.liabilities.updateFailed) };

  revalidatePath("/money/liabilities");
  revalidatePath("/money/net-worth");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteLiability(liabilityId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("liabilities").delete().eq("id", liabilityId).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "deleteLiability", dict.liabilities.deleteFailed) };

  revalidatePath("/money/liabilities");
  revalidatePath("/money/net-worth");
  revalidatePath("/dashboard");
  return { success: true };
}
