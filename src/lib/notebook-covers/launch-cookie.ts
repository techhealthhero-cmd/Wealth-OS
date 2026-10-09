import { z } from "zod";

import {
  COVER_DECORATIONS,
  DEFAULT_COVER_PREFERENCES,
  MAX_COVER_DECORATIONS,
  MAX_COVER_NAME_LENGTH,
  isCoverThemeId,
  isOpeningMode,
  type CoverDecorationId,
  type CoverPreferences,
} from "./config";

/**
 * A small, non-sensitive copy of the cover choice in a cookie, so the app
 * can paint the user's closed journal in the very first bytes of a launch —
 * before the profile query that the (app) layout waits on has returned.
 * Without it the screen stays blank (white on iOS) for that whole wait.
 *
 * Cosmetic only and never trusted for anything else: the database stays the
 * source of truth; the cookie is rewritten whenever the cover or opening
 * mode is saved, and a missing/garbled cookie just means the default cover.
 */
export const LAUNCH_COOKIE = "wos_cover";

export interface LaunchCookie {
  prefs: Pick<CoverPreferences, "theme" | "decorations" | "name" | "openingMode">;
  /** The account has already seen the full opening (first_time mode). */
  firstPlayed: boolean;
}

const decorationIds = new Set<string>(COVER_DECORATIONS.map((d) => d.id));

const raw = z.object({
  t: z.string().optional(),
  d: z.array(z.string()).optional(),
  n: z.string().nullable().optional(),
  m: z.string().optional(),
  fp: z.boolean().optional(),
});

export function encodeLaunchCookie(value: LaunchCookie): string {
  return encodeURIComponent(
    JSON.stringify({
      t: value.prefs.theme,
      d: value.prefs.decorations,
      n: value.prefs.name,
      m: value.prefs.openingMode,
      fp: value.firstPlayed,
    })
  );
}

export function decodeLaunchCookie(value: string | undefined | null): LaunchCookie {
  const fallback: LaunchCookie = {
    prefs: {
      theme: DEFAULT_COVER_PREFERENCES.theme,
      decorations: [],
      name: null,
      openingMode: DEFAULT_COVER_PREFERENCES.openingMode,
    },
    firstPlayed: false,
  };
  if (!value) return fallback;
  try {
    const parsed = raw.safeParse(JSON.parse(decodeURIComponent(value)));
    if (!parsed.success) return fallback;
    const v = parsed.data;
    return {
      prefs: {
        theme: isCoverThemeId(v.t) ? v.t : fallback.prefs.theme,
        decorations: (v.d ?? [])
          .filter((d): d is CoverDecorationId => decorationIds.has(d))
          .slice(0, MAX_COVER_DECORATIONS),
        name: v.n?.trim().slice(0, MAX_COVER_NAME_LENGTH) || null,
        openingMode: isOpeningMode(v.m) ? v.m : fallback.prefs.openingMode,
      },
      firstPlayed: v.fp ?? false,
    };
  } catch {
    return fallback;
  }
}

export const LAUNCH_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  // Readable/writable by the page on purpose: purely cosmetic, and the
  // launch updates it client-side (a Server Action cookie write would
  // refresh the route mid-animation).
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
};

/** Client-side write (after the first full opening in first_time mode). */
export function writeLaunchCookieClient(value: LaunchCookie): void {
  if (typeof document === "undefined") return;
  const o = LAUNCH_COOKIE_OPTIONS;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LAUNCH_COOKIE}=${encodeLaunchCookie(value)}; Path=${o.path}; Max-Age=${o.maxAge}; SameSite=Lax${secure}`;
}
