import type { AccountPrivacyDisplayStyle } from "@/types/database";

export interface AccountPrivacyState {
  enabled: boolean;
  protectAccounts: boolean;
  protectAssets: boolean;
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
