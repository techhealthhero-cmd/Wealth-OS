import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type { AccountPrivacyDisplayStyle } from "@/types/database";
import type { AccountPrivacyState } from "./types";

export const ACCOUNT_PRIVACY_COOKIE = "wealth_account_unlock";

interface PrivacyStateRow {
  enabled: boolean;
  display_style: AccountPrivacyDisplayStyle;
  custom_message: string | null;
  pin_configured: boolean;
  is_unlocked: boolean;
  unlocked_until: string | null;
  locked_until: string | null;
}

const DEFAULT_STATE: AccountPrivacyState = {
  enabled: false,
  displayStyle: "blur",
  customMessage: null,
  pinConfigured: false,
  isUnlocked: true,
  unlockedUntil: null,
  lockedUntil: null,
};

export const getAccountPrivacyState = cache(async (): Promise<AccountPrivacyState> => {
  const cookieStore = await cookies();
  const unlockToken = cookieStore.get(ACCOUNT_PRIVACY_COOKIE)?.value ?? null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_account_privacy_state", {
    p_unlock_token: unlockToken,
  });

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`[dev] Failed to load account privacy settings: ${error.message}`);
    }
    throw new Error("Failed to load account privacy settings");
  }

  const row = (Array.isArray(data) ? data[0] : data) as PrivacyStateRow | null;
  if (!row) return DEFAULT_STATE;

  return {
    enabled: row.enabled,
    displayStyle: row.display_style,
    customMessage: row.custom_message,
    pinConfigured: row.pin_configured,
    isUnlocked: row.is_unlocked,
    unlockedUntil: row.unlocked_until,
    lockedUntil: row.locked_until,
  };
});
