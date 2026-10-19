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
