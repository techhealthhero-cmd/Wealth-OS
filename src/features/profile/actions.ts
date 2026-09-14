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
 * Day-1 onboarding. Stores the display name on the profile, marks
 * onboarding complete, and creates a starting "Cash" account when the user
 * provided a starting balance — this is enough to give a usable dashboard
 * on first login without building the full multi-step onboarding yet.
 */
export async function completeOnboarding(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse({
    display_name: formData.get("display_name"),
    monthly_income: formData.get("monthly_income") || undefined,
    starting_balance: formData.get("starting_balance") || undefined,
    monthly_essential_expenses: formData.get("monthly_essential_expenses") || undefined,
    primary_goal: formData.get("primary_goal") || undefined,
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

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      onboarding_completed: true,
    })
    .eq("user_id", user.id);

  if (profileError) {
    return { error: "Could not save your profile. Please try again." };
  }

  if (parsed.data.starting_balance !== undefined) {
    await supabase.from("accounts").insert({
      user_id: user.id,
      name: "Cash",
      account_type: "cash",
      currency_code: "THB",
      opening_balance: parsed.data.starting_balance,
    });
  }

  trackEvent("onboarding_completed", user.id, { providedStartingBalance: parsed.data.starting_balance !== undefined });

  redirect("/dashboard");
}
