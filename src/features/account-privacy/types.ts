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
export interface AccountPrivacyActionState {
  error?: string;
  success?: boolean;
}
