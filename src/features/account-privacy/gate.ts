import "server-only";

import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { getAccountPrivacyState } from "./queries";
import {
  isPrivacyLockedFor,
  type AccountPrivacyState,
  type PrivacyScope,
} from "./types";

export interface PrivacyGateResult {
  privacy: AccountPrivacyState;
  copy: Dictionary["accountPrivacy"];
}

/**
 * Call before loading a protected page's financial rows. A non-null result
 * means the caller must render the privacy cover and stop fetching data.
 */
export async function getPrivacyGate(
  scopes: PrivacyScope | PrivacyScope[]
): Promise<PrivacyGateResult | null> {
  const [privacy, profile] = await Promise.all([
    getAccountPrivacyState(),
    getProfile(),
  ]);
  if (!isPrivacyLockedFor(privacy, scopes)) return null;

  const locale = await getLocale(profile?.preferred_language);
  return { privacy, copy: getDictionary(locale).accountPrivacy };
}
