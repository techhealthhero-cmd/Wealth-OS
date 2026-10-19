import { describe, expect, it } from "vitest";
import { angleFromProgress, isTap, progressFromDrag, shouldOpenOnRelease } from "@/features/notebook-cover/cover-swipe";

describe("closed cover swipe", () => {
  it("maps leftward travel over the mobile cover width and clamps both ends", () => {
    expect(progressFromDrag(-80, 250)).toBe(0.32);
    expect(progressFromDrag(-250, 250)).toBe(1);
    expect(progressFromDrag(-500, 250)).toBe(1);
    expect(progressFromDrag(80, 250)).toBe(0);
    expect(progressFromDrag(-80, 0)).toBe(0);
  });
  it("rotates around the spine through a clamped half turn", () => {
    expect(angleFromProgress(0)).toBeCloseTo(0);
    expect(angleFromProgress(0.35)).toBeCloseTo(-63);
    expect(angleFromProgress(1)).toBe(-180);
    expect(angleFromProgress(2)).toBe(-180);
    expect(angleFromProgress(-1)).toBeCloseTo(0);
  });
  it("opens at the distance threshold even after a slow release", () => {
    expect(shouldOpenOnRelease({ progress: 0.35, velocityX: 0, dx: -88 })).toBe(true);
    expect(shouldOpenOnRelease({ progress: 0.34, velocityX: -0.1, dx: -85 })).toBe(false);
  });
  it("requires a leftward flick with meaningful travel", () => {
    expect(shouldOpenOnRelease({ progress: 0.1, velocityX: -0.6, dx: -24 })).toBe(true);
    expect(shouldOpenOnRelease({ progress: 0.1, velocityX: -0.6, dx: -23 })).toBe(false);
    expect(shouldOpenOnRelease({ progress: 0.1, velocityX: -0.5, dx: -24 })).toBe(false);
    expect(shouldOpenOnRelease({ progress: 0.1, velocityX: 0.6, dx: 24 })).toBe(false);
  });
  it("uses total movement to distinguish taps from horizontal or vertical drags", () => {
    expect(isTap(0, 0)).toBe(true);
    expect(isTap(-4, 4)).toBe(true);
    expect(isTap(8, 0)).toBe(false);
    expect(isTap(0, -8)).toBe(false);
    expect(isTap(6, 6)).toBe(false);
  });
});
