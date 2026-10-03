import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { captureError } from "@/lib/observability";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import type { AccountPrivacyDisplayStyle } from "@/types/database";
import {
  DEFAULT_ACCOUNT_PRIVACY_STATE,
  FAIL_CLOSED_ACCOUNT_PRIVACY_STATE,
  type AccountPrivacyState,
} from "./types";

export const ACCOUNT_PRIVACY_COOKIE = "wealth_account_unlock";

interface PrivacyStateRow {
  enabled: boolean;
  protect_accounts: boolean;
  protect_assets: boolean;
  protect_overview: boolean;
  protect_activity: boolean;
  protect_planning: boolean;
  protect_insights: boolean;
  display_style: AccountPrivacyDisplayStyle;
  custom_message: string | null;
  pin_configured: boolean;
  is_unlocked: boolean;
  unlocked_until: string | null;
  locked_until: string | null;
}

export const getAccountPrivacyState = cache(async (): Promise<AccountPrivacyState> => {
  // Verify/refresh the Supabase session before calling the RPC. The account
  // page used to call the RPC concurrently with getProfile(); during a token
  // refresh that could reach Postgres without auth.uid() and crash only this
  // route with the generic Next.js error boundary.
  const user = await getAuthUser();
  if (!user) return FAIL_CLOSED_ACCOUNT_PRIVACY_STATE;

  const cookieStore = await cookies();
  const unlockToken = cookieStore.get(ACCOUNT_PRIVACY_COOKIE)?.value ?? null;
  const supabase = await createClient();
  const fetchState = () => supabase.rpc("get_account_privacy_state", { p_unlock_token: unlockToken });

  // Reported (2026-10-03): Home sometimes opened to a full-page
  // "ข้อมูลส่วนนี้ไม่พร้อมใช้งาน" cover — a single transient RPC failure
  // (network blip, token refresh race) dropped straight to the fail-closed
  // state. One short retry absorbs those; a persistent failure still fails
  // closed exactly as before.
  let { data, error } = await fetchState();
  if (error) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    ({ data, error } = await fetchState());
  }

  if (error) {
    captureError(new Error(error.message), {
      route: "account-privacy",
      provider: "supabase",
      operation: "get_account_privacy_state",
      userId: user.id,
      extra: { code: error.code ?? "unknown" },
    });
    return FAIL_CLOSED_ACCOUNT_PRIVACY_STATE;
  }

  const row = (Array.isArray(data) ? data[0] : data) as PrivacyStateRow | null;
  if (!row) return DEFAULT_ACCOUNT_PRIVACY_STATE;

  return {
    enabled: row.enabled,
    protectAccounts: row.protect_accounts,
    protectAssets: row.protect_assets,
    protectOverview: row.protect_overview,
    protectActivity: row.protect_activity,
    protectPlanning: row.protect_planning,
    protectInsights: row.protect_insights,
    displayStyle: row.display_style,
    customMessage: row.custom_message,
    pinConfigured: row.pin_configured,
    isUnlocked: row.is_unlocked,
    unlockedUntil: row.unlocked_until,
    lockedUntil: row.locked_until,
  };
});
