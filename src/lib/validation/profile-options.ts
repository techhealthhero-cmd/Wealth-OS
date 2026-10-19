/**
 * Shared option lists for the profile settings form. Used by both the UI
 * dropdowns (profile-form.tsx) and server validation (profile.ts) so the
 * server only ever accepts values the form can offer. Order is display
 * order: Thai defaults first.
 *
 * Labels live in i18n under `profileForm.currencies.<CODE>` and
 * `profileForm.timezones.<zone with "/" replaced by "_">` — see
 * `timezoneLabelKey`. UTC offsets in labels are static text on purpose
 * (no runtime Intl offset computation → no SSR/CSR hydration mismatch).
 */
export const PROFILE_CURRENCY_CODES = [
  "THB",
  "USD",
  "EUR",
  "JPY",
  "GBP",
  "SGD",
  "CNY",
  "HKD",
  "KRW",
  "AUD",
  "MYR",
  "LAK",
  "VND",
] as const;

export type ProfileCurrencyCode = (typeof PROFILE_CURRENCY_CODES)[number];

export const PROFILE_TIMEZONES = [
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
] as const;

export type ProfileTimezone = (typeof PROFILE_TIMEZONES)[number];

export const DEFAULT_PROFILE_CURRENCY: ProfileCurrencyCode = "THB";
export const DEFAULT_PROFILE_TIMEZONE: ProfileTimezone = "Asia/Bangkok";

export function isProfileCurrencyCode(value: string): value is ProfileCurrencyCode {
  return (PROFILE_CURRENCY_CODES as readonly string[]).includes(value);
}

export function isProfileTimezone(value: string): value is ProfileTimezone {
  return (PROFILE_TIMEZONES as readonly string[]).includes(value);
}

/** i18n key for a timezone label ("Asia/Hong_Kong" → "profileForm.timezones.Asia_Hong_Kong"). */
export function timezoneLabelKey(zone: ProfileTimezone): string {
  return `profileForm.timezones.${zone.replace(/\//g, "_")}`;
}
