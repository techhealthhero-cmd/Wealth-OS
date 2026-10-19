/** Leftward travel across one cover width opens the cover completely. */
export function progressFromDrag(dx: number, width: number): number {
  return width > 0 ? Math.min(1, Math.max(0, -dx / width)) : 0;
}

export function angleFromProgress(progress: number): number {
  return -180 * Math.min(1, Math.max(0, progress));
}

export function shouldOpenOnRelease({ progress, velocityX, dx }: {
  progress: number; velocityX: number; dx: number;
}): boolean {
  return dx < 0 && (progress >= 0.35 || (velocityX < -0.5 && dx <= -24));
}

export function isTap(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < 8;
}

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

/** Angles outside the opening arc (including snap-back overshoot) stay safe. */
export function coverShading(angleDeg: number) {
  const progress = clampUnit(-angleDeg / 180);
  return {
    front: 0.42 * Math.min(1, progress * 2),
    back: 0.32 * (1 - progress),
    // Rise quickly off the closed cover, then let the cast shadow lift away.
    page: 0.6 * Math.min(1, progress * 12) * (1 - progress),
  };
}

export function coverReleaseEasing(progress: number, open: boolean): number {
  const t = clampUnit(progress);
  if (open) return 1 - (1 - t) ** 3;
  const overshoot = 0.7;
  return 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

export function coverReleaseDuration(angleDeg: number, open: boolean): number {
  const remaining = clampUnit(Math.abs((open ? -180 : 0) - angleDeg) / 180);
  return open ? 180 + 140 * remaining : 260 + 120 * remaining;
}

/**
 * Which side of the cover faces the viewer. Painted explicitly as well as via
 * backface-visibility, so a renderer that flattens the 3D context (older iOS
 * WebKit with SVG children, software compositing) never shows the wrong side.
 */
export function coverSideShowing(angleDeg: number): "front" | "back" {
  return angleDeg < -90 ? "back" : "front";
}

/** The closed book's resting pose (LaunchStillScene / first opening keyframe). */
export const CLOSED_BOOK_POSE = "translateX(0) rotateY(8deg) scale(0.98)";

/**
 * The book follows the cover the way the opening animation does (nb-quick-book:
 * drift 9% right, square up to the viewer, grow slightly), so the inside of the
 * cover stays on screen as it lays open. Closed returns the exact resting pose.
 */
export function bookPoseFromAngle(angleDeg: number): string {
  const p = clampUnit(-angleDeg / 180);
  if (p === 0) return CLOSED_BOOK_POSE;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return `translateX(${round(9 * p)}%) rotateY(${round(8 * (1 - p))}deg) scale(${round(0.98 + 0.04 * p)})`;
}
