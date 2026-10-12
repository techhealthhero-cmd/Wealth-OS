"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { friendlyDbError } from "@/lib/db-error";
import { centsToDecimalString } from "@/lib/financial/money";
import { normalizeUnitWord } from "@/lib/capture/units";
import type { AccountAliasSource } from "@/types/database";

/**
 * Per-unit prices for capture (capture_units, migration 0044): "ได้ 10 ดื่ม"
 * → 10 × ฿200. Rows only turn a spoken count into an amount; they never
 * move money. RLS scopes every read and write to the signed-in user.
 */

export interface CaptureUnitRow {
  id: string;
  unit_normalized: string;
  unit_label: string;
  unit_price: string;
  type: "income" | "expense";
  category_id: string | null;
  source: AccountAliasSource;
}

const COLUMNS = "id, unit_normalized, unit_label, unit_price, type, category_id, source";

async function getRequestDictionary() {
  const profile = await getProfile();
  return getDictionary(await getLocale(profile?.preferred_language));
}

/** Before migration 0044 the table doesn't exist yet. */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** All of the user's units. Empty when none, or before migration 0044. */
export async function getCaptureUnits(): Promise<CaptureUnitRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("capture_units").select(COLUMNS).order("created_at", { ascending: true }).limit(200);
  if (error) return [];
  return (data ?? []) as CaptureUnitRow[];
}

/**
 * Active per-unit income sources from Earn ("฿200 per ดื่ม", migration 0036):
 * capture prices those words too, so a unit set up there is never asked again.
 */
export async function getIncomeSourceUnits(): Promise<{ unit_label: string; unit_rate: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_sources")
    .select("unit_label, unit_rate")
    .eq("pay_basis", "per_unit")
    .eq("is_active", true)
    .not("unit_label", "is", null)
    .not("unit_rate", "is", null)
    .limit(50);
  if (error) return [];
  return (data ?? []) as { unit_label: string; unit_rate: string }[];
}

const unitInputSchema = z.object({
  word: z.string().trim().min(1).max(40),
  priceCents: z.number().int().positive().max(1_000_000_000),
  type: z.enum(["income", "expense"]),
  categoryId: z.string().uuid().nullable(),
  source: z.enum(["user", "learned"]),
});

export type SaveCaptureUnitInput = z.input<typeof unitInputSchema>;

/**
 * "<word> = ฿price". Saving a word again re-prices it. The database trigger
 * checks the category is a system one or the user's own.
 */
export async function saveCaptureUnit(
  input: SaveCaptureUnitInput
): Promise<{ success?: true; error?: string; unit?: CaptureUnitRow }> {
  const dict = await getRequestDictionary();
  const parsed = unitInputSchema.safeParse(input);
  const key = parsed.success ? normalizeUnitWord(parsed.data.word) : "";
  if (!parsed.success || !key) return { error: dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { data, error } = await supabase
    .from("capture_units")
    .upsert(
      {
        user_id: user.id,
        unit_normalized: key,
        unit_label: parsed.data.word.trim(),
        unit_price: centsToDecimalString(parsed.data.priceCents),
        type: parsed.data.type,
        category_id: parsed.data.categoryId,
        source: parsed.data.source,
      },
      { onConflict: "user_id,unit_normalized" }
    )
    .select(COLUMNS)
    .single();

  if (error) {
    if (isMissingTable(error)) return { error: dict.capture.units.notReady };
    return { error: friendlyDbError(error, "saveCaptureUnit", dict.capture.units.saveFailed) };
  }
  return { success: true, unit: data as CaptureUnitRow };
}

export async function deleteCaptureUnit(unitId: string): Promise<{ success?: true; error?: string }> {
  const dict = await getRequestDictionary();
  if (!z.string().uuid().safeParse(unitId).success) return { error: dict.common.invalidInput };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("capture_units").delete().eq("id", unitId).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "deleteCaptureUnit", dict.capture.units.saveFailed) };
  return { success: true };
}
