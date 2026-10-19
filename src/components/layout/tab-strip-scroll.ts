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
