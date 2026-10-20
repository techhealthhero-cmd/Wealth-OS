/** Minimal horizontal reveal with breathing room; visible tabs leave scroll alone. */
export function tabStripScrollTarget(
  offsetLeft: number,
  offsetWidth: number,
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  padding = 8,
): number | null {
  const right = offsetLeft + offsetWidth;
  let target: number;
  if (offsetLeft < scrollLeft) target = offsetLeft - padding;
  else if (right > scrollLeft + clientWidth) target = right - clientWidth + padding;
  else return null;
  return Math.max(0, Math.min(target, Math.max(0, scrollWidth - clientWidth)));
}

/** Ignore subpixel rounding and Safari's elastic overscroll at either edge. */
export function tabStripMask(scrollLeft: number, clientWidth: number, scrollWidth: number): string {
  const max = Math.max(0, scrollWidth - clientWidth);
  const left = Math.max(0, Math.min(scrollLeft, max));
  const fadeLeft = left > 1;
  const fadeRight = max - left > 1;
  if (!fadeLeft && !fadeRight) return "none";
  return `linear-gradient(to right, ${fadeLeft ? "transparent, black 16px" : "black"}, ${fadeRight ? "black calc(100% - 16px), transparent" : "black"})`;
}
