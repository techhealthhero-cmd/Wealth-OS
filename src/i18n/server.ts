import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";

/**
 * Resolves the active locale for a request, in order of precedence:
 * 1. The `preferredLanguage` explicitly passed in (from the signed-in user's
 *    profile row — the durable, cross-device source of truth).
 * 2. The `wealthos_locale` cookie (set by the language switcher for signed-
 *    out visitors / before the profile has loaded).
 * 3. The Thai default.
 */
export async function getLocale(preferredLanguage?: string | null): Promise<Locale> {
  if (isLocale(preferredLanguage)) return preferredLanguage;

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  return DEFAULT_LOCALE;
}
