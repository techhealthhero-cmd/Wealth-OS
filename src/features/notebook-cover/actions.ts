"use server";

import { revalidatePath } from "next/cache";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { coverPreferencesSchema, type CoverPreferences } from "@/lib/notebook-covers/config";

export type SaveCoverResult =
  | { success: true }
  | { success: false; error: string; code: "signed_out" | "invalid" | "not_ready" | "failed" };

/** Postgres/PostgREST codes for "column doesn't exist yet" (migration 0040 not applied). */
function isCoverSchemaMissing(code: string | undefined): boolean {
  return code === "42703" || code === "PGRST204";
}

/**
 * Saves the signed-in user's notebook cover preferences (cosmetic only).
 * The client sends ids, never a user id: ownership comes from the session,
 * and the profiles update-own RLS policy enforces it again in the database.
 *
 * `markChosen` stamps cover_chosen_at (and opening_first_played_at) — set
 * by the first-time cover onboarding (finish or skip) so it is never shown
 * again.
 */
export async function saveCoverPreferences(
  input: CoverPreferences,
  options: { markChosen?: boolean } = {}
): Promise<SaveCoverResult> {
  const user = await getAuthUser();
  const profile = await getProfile();
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  if (!user) return { success: false, error: dict.notebookCover.errors.signedOut, code: "signed_out" };

  const parsed = coverPreferencesSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: dict.notebookCover.errors.invalid, code: "invalid" };

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      cover_theme: parsed.data.theme,
      cover_decorations: parsed.data.decorations,
      cover_name: parsed.data.name,
      notebook_opening_mode: parsed.data.openingMode,
      // The onboarding plays the full opening, which also counts as the
      // "first time" for the first_time mode.
      ...(options.markChosen ? { cover_chosen_at: now, opening_first_played_at: now } : {}),
    })
    .eq("user_id", user.id);

  if (error) {
    if (!isCoverSchemaMissing(error.code)) console.error("[notebook-cover] save failed:", error.code);
    return isCoverSchemaMissing(error.code)
      ? { success: false, error: dict.notebookCover.errors.notReady, code: "not_ready" }
      : { success: false, error: dict.notebookCover.errors.saveFailed, code: "failed" };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/cover");
  return { success: true };
}

/**
 * Records that this account has now seen the full opening, for the
 * "first_time" mode. Called once by the launch opening. Only ever sets the
 * timestamp when it is still empty, never touches the chosen mode, and
 * deliberately doesn't revalidate (no re-render or refetch mid-launch).
 */
export async function markFirstOpeningPlayed(): Promise<void> {
  const user = await getAuthUser();
  if (!user) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ opening_first_played_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("opening_first_played_at", null);
  if (error && !isCoverSchemaMissing(error.code)) console.error("[notebook-cover] mark first opening failed:", error.code);
}
