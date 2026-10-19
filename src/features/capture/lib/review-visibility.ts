/** Scroll down only enough to reveal a clipped review action; preserve user scrolling. */
export function reviewScrollDelta(viewportBottom: number, actionBottom: number): number {
  return Math.max(0, actionBottom - viewportBottom);
}
