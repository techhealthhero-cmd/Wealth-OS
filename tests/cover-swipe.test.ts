import { describe, expect, it } from "vitest";
import { angleFromProgress, bookPoseFromAngle, CLOSED_BOOK_POSE, coverShading, coverSideShowing, coverReleaseDuration, coverReleaseEasing, isTap, progressFromDrag, shouldOpenOnRelease } from "@/features/notebook-cover/cover-swipe";

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


describe("cover lighting and release", () => {
  it("keeps closed paper unshaded and clamps beyond the opening arc", () => {
    expect(coverShading(0).page).toBe(0);
    expect(coverShading(30)).toEqual(coverShading(0));
    expect(coverShading(-240)).toEqual(coverShading(-180));
    for (let angle = 30; angle >= -240; angle--) {
      for (const opacity of Object.values(coverShading(angle))) {
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      }
    }
  });
  it("darkens the front toward edge-on and lifts back/page shadows as it opens", () => {
    for (let angle = 0; angle > -90; angle--) {
      expect(coverShading(angle - 1).front).toBeGreaterThanOrEqual(coverShading(angle).front);
    }
    for (let angle = -15; angle > -180; angle--) {
      expect(coverShading(angle - 1).page).toBeLessThanOrEqual(coverShading(angle).page);
      expect(coverShading(angle - 1).back).toBeLessThanOrEqual(coverShading(angle).back);
    }
    expect(coverShading(-180).page).toBe(0);
    expect(coverShading(-180).back).toBe(0);
  });
  it("eases open monotonically and gives snap-back a gentle overshoot", () => {
    for (const open of [true, false]) {
      expect(coverReleaseEasing(-1, open)).toBeCloseTo(0);
      expect(coverReleaseEasing(2, open)).toBe(1);
    }
    for (let i = 0; i < 100; i++) {
      expect(coverReleaseEasing((i + 1) / 100, true)).toBeGreaterThanOrEqual(coverReleaseEasing(i / 100, true));
    }
    expect(coverReleaseEasing(0.8, false)).toBeGreaterThan(1);
    expect(coverReleaseEasing(0.8, false)).toBeLessThan(1.05);
  });
  it("scales bounded durations with remaining angular distance", () => {
    expect(coverReleaseDuration(-180, true)).toBe(180);
    expect(coverReleaseDuration(0, true)).toBe(320);
    expect(coverReleaseDuration(0, false)).toBe(260);
    expect(coverReleaseDuration(-180, false)).toBe(380);
    expect(coverReleaseDuration(-90, true)).toBe(250);
    expect(coverReleaseDuration(-90, false)).toBe(320);
    expect(coverReleaseDuration(900, true)).toBe(320);
  });
});

describe("cover side", () => {
  it("shows the front until edge-on, then the inside of the cover", () => {
    expect(coverSideShowing(0)).toBe("front");
    expect(coverSideShowing(-45)).toBe("front");
    expect(coverSideShowing(-90)).toBe("front");
    expect(coverSideShowing(-91)).toBe("back");
    expect(coverSideShowing(-180)).toBe("back");
    expect(coverSideShowing(4)).toBe("front");
  });
});

describe("book pose while the cover turns", () => {
  it("rests in the launch-still pose and ends where the opening animation ends", () => {
    expect(CLOSED_BOOK_POSE).toBe("translateX(0) rotateY(8deg) scale(0.98)");
    expect(bookPoseFromAngle(0)).toBe(CLOSED_BOOK_POSE);
    expect(bookPoseFromAngle(5)).toBe(CLOSED_BOOK_POSE);
    expect(bookPoseFromAngle(-90)).toBe("translateX(4.5%) rotateY(4deg) scale(1)");
    expect(bookPoseFromAngle(-180)).toBe("translateX(9%) rotateY(0deg) scale(1.02)");
    expect(bookPoseFromAngle(-400)).toBe(bookPoseFromAngle(-180));
  });
});
