"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildAssetSchema, buildUpdateAssetSchema } from "@/lib/validation/asset";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseAssetFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    asset_type: formData.get("asset_type"),
    value: formData.get("value") ?? 0,
    currency_code: formData.get("currency_code") || undefined,
    include_in_net_worth: formData.get("include_in_net_worth") === "on",
    linked_account_id: formData.get("linked_account_id") || null,
    notes: formData.get("notes") || undefined,
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

export async function createAsset(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildAssetSchema(dict).safeParse(parseAssetFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("assets").insert({
    ...parsed.data,
    notes: parsed.data.notes || null,
    last_updated_at: new Date().toISOString(),
    user_id: user.id,
  });

  if (error) return { error: friendlyDbError(error, "createAsset", dict.assets.createFailed) };

  revalidatePath("/money/assets");
  revalidatePath("/money/net-worth");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateAsset(
  assetId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildUpdateAssetSchema(dict).safeParse(parseAssetFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("assets")
    .update({ ...parsed.data, notes: parsed.data.notes || null, last_updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .eq("user_id", user.id);

  if (error) return { error: friendlyDbError(error, "updateAsset", dict.assets.updateFailed) };

  revalidatePath("/money/assets");
  revalidatePath("/money/net-worth");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteAsset(assetId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("assets").delete().eq("id", assetId).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "deleteAsset", dict.assets.deleteFailed) };

  revalidatePath("/money/assets");
  revalidatePath("/money/net-worth");
  revalidatePath("/dashboard");
  return { success: true };
}
