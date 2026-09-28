"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  accountPrivacyPinSchema,
  accountPrivacySettingsSchema,
  accountPrivacyUnlockSchema,
} from "@/lib/validation/account-privacy";
import { getProfile } from "@/features/profile/queries";
import { ACCOUNT_PRIVACY_COOKIE, getAccountPrivacyState } from "./queries";
import type { AccountPrivacyActionState } from "./types";

async function getPrivacyMessages() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale).accountPrivacy;
}

function refreshPrivacyViews() {
  revalidatePath("/profile");
  revalidatePath("/money/accounts");
}

export async function configureAccountPrivacy(
  _previous: AccountPrivacyActionState | undefined,
  formData: FormData
): Promise<AccountPrivacyActionState> {
  const [user, messages] = await Promise.all([getAuthUser(), getPrivacyMessages()]);
  if (!user) return { error: messages.authenticationRequired };

  const parsed = accountPrivacySettingsSchema.safeParse({
    enabled: formData.get("enabled"),
    displayStyle: formData.get("display_style"),
    customMessage: formData.get("custom_message") ?? "",
    pin: formData.get("pin") ?? "",
    pinConfirmation: formData.get("pin_confirmation") ?? "",
  });
  if (!parsed.success) return { error: messages.invalidSettings };

  const current = await getAccountPrivacyState();
  if ((parsed.data.enabled || current.pinConfigured) && !accountPrivacyPinSchema.safeParse(parsed.data.pin).success) {
    return { error: messages.pinRequirement };
  }
  if (!current.pinConfigured && parsed.data.enabled && parsed.data.pin !== parsed.data.pinConfirmation) {
    return { error: messages.pinMismatch };
  }
  if (parsed.data.displayStyle === "custom" && !parsed.data.customMessage) {
    return { error: messages.customMessageRequired };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("configure_account_privacy", {
    p_enabled: parsed.data.enabled,
    p_display_style: parsed.data.displayStyle,
    p_custom_message: parsed.data.customMessage,
    p_pin: parsed.data.pin,
  });

  if (error) {
    return { error: error.message.includes("invalid_pin") ? messages.invalidPin : messages.saveFailed };
  }

  const cookieStore = await cookies();
  cookieStore.delete(ACCOUNT_PRIVACY_COOKIE);
  refreshPrivacyViews();
  return { success: true };
}

export async function unlockAccountPrivacy(
  _previous: AccountPrivacyActionState | undefined,
  formData: FormData
): Promise<AccountPrivacyActionState> {
  const [user, messages] = await Promise.all([getAuthUser(), getPrivacyMessages()]);
  if (!user) return { error: messages.authenticationRequired };

  const parsed = accountPrivacyUnlockSchema.safeParse({ pin: formData.get("pin") ?? "" });
  if (!parsed.success) return { error: messages.pinRequirement };

  const unlockToken = randomBytes(32).toString("base64url");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unlock_account_privacy", {
    p_pin: parsed.data.pin,
    p_unlock_token: unlockToken,
  });

  if (error) return { error: messages.unlockFailed };
  if (data === "temporarily_locked") return { error: messages.tooManyAttempts };
  if (data !== "unlocked") return { error: messages.invalidPin };

  const cookieStore = await cookies();
  cookieStore.set(ACCOUNT_PRIVACY_COOKIE, unlockToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 15,
  });
  refreshPrivacyViews();
  return { success: true };
}

export async function lockAccountPrivacy(): Promise<void> {
  const user = await getAuthUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase.rpc("lock_account_privacy");
  const cookieStore = await cookies();
  cookieStore.delete(ACCOUNT_PRIVACY_COOKIE);
  refreshPrivacyViews();
}
