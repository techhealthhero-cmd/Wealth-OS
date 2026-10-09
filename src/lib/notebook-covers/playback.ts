/**
 * When the notebook-opening animation plays (pure, unit-tested).
 *
 * People open WEALTH OS to see their money quickly, so the opening is a
 * moment, not a gate: it plays in full only when the user has just finished
 * choosing their journal (first-time onboarding), has just saved a new cover
 * in Settings, or explicitly asks to open it ("เปิดสมุดของฉัน"). The first two
 * follow the user's "opening animation" switch; the explicit tap always
 * plays. App launches, returning from the background and
 * in-app navigation never trigger it — there is deliberately no reason for
 * those here.
 */
export type OpeningReason = "onboarding" | "cover-change" | "user-replay";

export type OpeningMode = "full" | "reduced" | "none";

export function getOpeningMode({
  reason,
  enabled,
  prefersReducedMotion,
}: {
  reason: OpeningReason;
  /** The user's "play opening animation" preference. */
  enabled: boolean;
  prefersReducedMotion: boolean;
}): OpeningMode {
  // An explicit tap always shows something — the user asked for it — but
  // still honours the OS reduced-motion setting.
  if (reason === "user-replay") return prefersReducedMotion ? "reduced" : "full";
  if (!enabled) return "none";
  return prefersReducedMotion ? "reduced" : "full";
}

/**
 * Stage timings in ms (brief: ~300 / 600–800 / 250–350 / 250–350, total
 * ≤ 1.8 s). The reduced variant is a single short cross-fade.
 */
export const OPENING_TIMINGS = {
  full: { closed: 300, open: 750, reveal: 300, exit: 300 },
  reduced: { closed: 0, open: 0, reveal: 250, exit: 200 },
} as const;

export function totalOpeningDuration(mode: Exclude<OpeningMode, "none">): number {
  const t = OPENING_TIMINGS[mode];
  return t.closed + t.open + t.reveal + t.exit;
}
