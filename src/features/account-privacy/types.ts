import type { AccountPrivacyDisplayStyle } from "@/types/database";

export interface AccountPrivacyState {
  enabled: boolean;
  protectAccounts: boolean;
  protectAssets: boolean;
  protectOverview: boolean;
  protectActivity: boolean;
  protectPlanning: boolean;
  protectInsights: boolean;
  displayStyle: AccountPrivacyDisplayStyle;
  customMessage: string | null;
  pinConfigured: boolean;
  isUnlocked: boolean;
  unlockedUntil: string | null;
  lockedUntil: string | null;
}

export const DEFAULT_ACCOUNT_PRIVACY_STATE: AccountPrivacyState = {
  enabled: false,
  protectAccounts: true,
  protectAssets: false,
  protectOverview: false,
  protectActivity: false,
  protectPlanning: false,
  protectInsights: false,
  displayStyle: "blur",
  customMessage: null,
  pinConfigured: false,
  isUnlocked: true,
  unlockedUntil: null,
  lockedUntil: null,
};

// Privacy must fail closed. If the settings RPC is temporarily unavailable,
// never fall through to fetching protected account or asset data.
export const FAIL_CLOSED_ACCOUNT_PRIVACY_STATE: AccountPrivacyState = {
  enabled: true,
  protectAccounts: true,
  protectAssets: true,
  protectOverview: true,
  protectActivity: true,
  protectPlanning: true,
  protectInsights: true,
  displayStyle: "unavailable",
  customMessage: null,
  pinConfigured: false,
  isUnlocked: false,
  unlockedUntil: null,
  lockedUntil: null,
};

export interface AccountPrivacyActionState {
  error?: string;
  success?: boolean;
}

export type PrivacyScope =
  | "accounts"
  | "assets"
  | "overview"
  | "activity"
  | "planning"
  | "insights";

const PRIVACY_SCOPE_FIELD: Record<PrivacyScope, keyof AccountPrivacyState> = {
  accounts: "protectAccounts",
  assets: "protectAssets",
  overview: "protectOverview",
  activity: "protectActivity",
  planning: "protectPlanning",
  insights: "protectInsights",
};

export function isPrivacyLockedFor(
  privacy: AccountPrivacyState,
  scopes: PrivacyScope | PrivacyScope[]
): boolean {
  if (!privacy.enabled || privacy.isUnlocked) return false;
  const requested = Array.isArray(scopes) ? scopes : [scopes];
  return requested.some((scope) => privacy[PRIVACY_SCOPE_FIELD[scope]] === true);
}
