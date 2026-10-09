import type { OpeningMode } from "./config";

/**
 * When the notebook-opening animation plays, and which variant (pure,
 * unit-tested). Two variants share one component (NotebookOpening):
 *
 *  - "quick" (~1 s): the cover swings open and the app is right there.
 *    The default on every fresh app launch.
 *  - "full"  (~1.65 s): closed journal → cover opens → the first page says
 *    hello → the app. Skippable.
 *
 * This is the *cover* opening only. Turning pages between sections is a
 * separate system (SwipeTabPages) with its own timing; neither setting
 * affects the other.
 */
export type OpeningVariant = "full" | "quick";

/**
 * What a fresh app launch (a new document load) shows for the user's mode.
 * `firstPlayed` = the account has already seen the full opening once
 * (profiles.opening_first_played_at).
 */
export function getLaunchVariant({
  mode,
  firstPlayed,
}: {
  mode: OpeningMode;
  firstPlayed: boolean;
}): OpeningVariant | null {
  switch (mode) {
    case "full":
      return "full";
    case "quick":
      return "quick";
    case "first_time":
      return firstPlayed ? null : "full";
    case "off":
      return null;
  }
}

/**
 * Openings triggered inside the app (not by a launch):
 *  - "onboarding": the user just chose their journal — always the full
 *    opening (it is their first time), skippable.
 *  - "cover-change": a new cover was saved — a quick opening, unless the
 *    user turned animations off.
 *  - "preview": an explicit tap on a preview button — always plays the
 *    variant asked for, and never changes any saved state.
 */
export function getInAppVariant(
  reason: "onboarding" | "cover-change" | { preview: OpeningMode },
  mode: OpeningMode
): OpeningVariant | null {
  if (reason === "onboarding") return "full";
  if (reason === "cover-change") return mode === "off" ? null : "quick";
  // Previewing "first time only" shows what that first time looks like.
  return reason.preview === "quick" ? "quick" : reason.preview === "off" ? null : "full";
}

/**
 * Stage timings in ms. The CSS keyframes in globals.css (.nb-open) are
 * written from these numbers — change both together.
 *  full:  closed 300 → cover opens 750 → page reveal 300 → exit 300
 *  quick: closed 150 → cover opens 600 → settle/exit 250
 */
export const OPENING_TIMINGS = {
  full: { closed: 300, open: 750, reveal: 300, exit: 300 },
  quick: { closed: 150, open: 600, reveal: 0, exit: 250 },
} as const;

export function totalOpeningDuration(variant: OpeningVariant): number {
  const t = OPENING_TIMINGS[variant];
  return t.closed + t.open + t.reveal + t.exit;
}
