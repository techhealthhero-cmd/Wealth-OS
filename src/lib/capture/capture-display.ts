/** Pure viewport decision; browser chrome jitter and pinch zoom are not keyboards. */
export interface CaptureViewport { layoutHeight: number; height: number; offsetTop: number; scale?: number }
export function captureLayout(viewport?: CaptureViewport | null): "a" | "b" {
  if (!viewport || !Number.isFinite(viewport.layoutHeight) || viewport.layoutHeight <= 0 || !Number.isFinite(viewport.height) || viewport.height <= 0 || (viewport.scale ?? 1) > 1.05) return "a";
  return viewport.layoutHeight - viewport.height > 150 ? "b" : "a";
}
export const SUGGESTION_DELAY = 14 * 24 * 60 * 60 * 1000;
export interface SuggestionSession { count: number; shown: boolean }
export function countCaptureEffort(session: SuggestionSession): SuggestionSession {
  return { ...session, count: Math.min(3, session.count + 1) };
}
export function shouldSuggestLargeText(session: SuggestionSession, largeText: boolean, dismissedAt: number | null, now: number): boolean {
  return !largeText && !session.shown && session.count >= 3 && (dismissedAt === null || now - dismissedAt >= SUGGESTION_DELAY);
}
