import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Returns the signed-in user's profile, or null if there is no session.
 * Does not throw for a missing row — callers (the app layout) decide
 * whether to redirect to onboarding.
 *
 * Every authenticated user should have a profile row, created by the
 * `handle_new_user` trigger on signup. If one is missing anyway — e.g. the
 * account was created before that trigger existed, or the trigger failed for
 * any other reason — this self-heals by creating it here with the same
 * defaults, rather than leaving the user stuck in an unrecoverable redirect
 * loop back to /login (a real Day-1 incident: an account created before
 * migrations were applied had no profile and could never reach the app).
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[profile] Failed to load profile:", {
      message: error.message,
      code: error.code,
      hint: error.hint,
      details: error.details,
    });
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        `[dev] Failed to load profile (${error.code ?? "?"}): ${error.message}. ` +
          `If this says the table doesn't exist, the database migrations haven't been applied yet — see README "Migration commands".`
      );
    }
    throw new Error("Failed to load profile");
  }

  if (data) return data;

  const displayName =
    typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null;

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert({ user_id: user.id, display_name: displayName })
    .select("*")
    .single();

  if (!createError) return created;

  // 23505 = unique_violation: another concurrent request already created it
  // (e.g. two tabs loading at once) — re-fetch instead of treating as fatal.
  if (createError.code === "23505") {
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    return existing;
  }

  console.error("[profile] Failed to self-heal missing profile:", {
    message: createError.message,
    code: createError.code,
  });
  if (process.env.NODE_ENV !== "production") {
    throw new Error(`[dev] Failed to create missing profile (${createError.code ?? "?"}): ${createError.message}`);
  }
  throw new Error("Failed to load profile");
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
