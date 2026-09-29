import type { AccountPrivacyDisplayStyle } from "@/types/database";

export interface AccountPrivacyState {
  enabled: boolean;
  displayStyle: AccountPrivacyDisplayStyle;
  customMessage: string | null;
  pinConfigured: boolean;
  isUnlocked: boolean;
  unlockedUntil: string | null;
  lockedUntil: string | null;
}

export const DEFAULT_ACCOUNT_PRIVACY_STATE: AccountPrivacyState = {
  enabled: false,
  displayStyle: "blur",
  customMessage: null,
  pinConfigured: false,
  isUnlocked: true,
  unlockedUntil: null,
  lockedUntil: null,
};

// Privacy must fail closed. If the settings RPC is temporarily unavailable,
// never fall through to fetching and rendering real account balances.
export const FAIL_CLOSED_ACCOUNT_PRIVACY_STATE: AccountPrivacyState = {
  enabled: true,
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
