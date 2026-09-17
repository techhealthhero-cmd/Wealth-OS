"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, profileSchema } from "@/lib/validation/profile";
import { LOCALE_COOKIE } from "@/i18n/config";
import { cookies } from "next/headers";
import { trackEvent } from "@/lib/analytics";

export interface ActionResult {
  error?: string;
}

export async function updateProfile(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    display_name: formData.get("display_name"),
    preferred_language: formData.get("preferred_language"),
    currency_code: formData.get("currency_code"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Could not save your profile. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, parsed.data.preferred_language, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return {};
}

/**
 * Day-1 onboarding, reduced to the minimum that produces real first-session
 * value (see PRODUCT_OUTCOMES.md "Time to First Useful Value"): display name
 * plus one optional starting account. Stores the display name on the
 * profile, marks onboarding complete, and — when the user gave a starting
 * balance — creates their first account with the chosen type/name so the
 * dashboard has something real to show immediately.
 *
 * Idempotency: a rapid double-submit (double-click, Enter held down, or a
 * browser retrying an in-flight request) can invoke this action twice
 * before the client-side `disabled` state takes effect, and both
 * invocations would otherwise pass every check identically — the second
 * one creating a duplicate starting account. The `.eq("onboarding_completed",
 * false)` below turns the profile update into an atomic compare-and-swap:
 * Postgres only lets one concurrent request flip the flag from false to
 * true, so only that one request's `.select()` gets a row back, and only
 * that request proceeds to create the starting account. A losing duplicate
 * request gets `updatedProfile === null` and simply redirects — the
 * winner's write already produced the state the user asked for, so this is
 * a silent no-op, not an error. No new schema constraint was needed (a
 * unique constraint on account name/type per user would incorrectly block
 * legitimate accounts of the same type added later from `/money/accounts`).
 */
export async function completeOnboarding(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse({
    display_name: formData.get("display_name"),
    starting_balance: formData.get("starting_balance") || undefined,
    starting_account_type: formData.get("starting_account_type") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: updatedProfile, error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      onboarding_completed: true,
    })
    .eq("user_id", user.id)
    .eq("onboarding_completed", false)
    .select("user_id")
    .maybeSingle();

  if (profileError) {
    return { error: "Could not save your profile. Please try again." };
  }

  if (updatedProfile && parsed.data.starting_balance !== undefined) {
    const accountType = parsed.data.starting_account_type;
    await supabase.from("accounts").insert({
      user_id: user.id,
      name: accountType === "bank" ? "Bank" : "Cash",
      account_type: accountType,
      currency_code: "THB",
      opening_balance: parsed.data.starting_balance,
    });
  }

  if (updatedProfile) {
    trackEvent("onboarding_completed", user.id, { providedStartingBalance: parsed.data.starting_balance !== undefined });
  }

  redirect("/dashboard");
}
