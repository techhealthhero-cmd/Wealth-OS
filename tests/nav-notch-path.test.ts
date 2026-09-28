import { describe, expect, it } from "vitest";

import {
  buildNotchedBarPath,
  fitNotchToSlot,
  notchHalfWidth,
  shoulderReach,
} from "@/components/layout/nav-notch-path";

const GEO = { notchRadius: 26, centerY: 4, fillet: 16, minFillet: 5 };

describe("shoulderReach", () => {
  it("is where a fillet tangent to the notch circle meets the flat top edge", () => {
    const s = 10;
    const reach = shoulderReach(GEO.notchRadius, GEO.centerY, s);
    // Fillet center (reach, s) sits R + s from the notch center (0, cy).
    expect(Math.hypot(reach, s - GEO.centerY)).toBeCloseTo(GEO.notchRadius + s, 6);
  });

  it("grows with a broader fillet", () => {
    expect(shoulderReach(26, 4, 16)).toBeGreaterThan(shoulderReach(26, 4, 5));
  });
});

describe("fitNotchToSlot", () => {
  it("keeps the preferred geometry when minimum shoulders fit", () => {
    expect(fitNotchToSlot(GEO, 67)).toEqual(GEO);
  });

  it("shrinks the notch on very narrow phones", () => {
    const fitted = fitNotchToSlot(GEO, 50, 2);
    expect(fitted.notchRadius).toBeLessThan(GEO.notchRadius);
    expect(notchHalfWidth(fitted, fitted.minFillet) * 2).toBeLessThanOrEqual(50 - 2);
  });
});

describe("buildNotchedBarPath", () => {
  it("draws a plain rounded bar when there are no notches", () => {
    const d = buildNotchedBarPath(300, 60, 24, [], GEO);
    expect(d).not.toContain("A 26 26");
    expect(d.startsWith("M 0 24")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("uses broad shoulders for a lone notch with room on both sides", () => {
    const d = buildNotchedBarPath(360, 60, 24, [180], GEO);
    expect(d.match(/A 16 16/g)).toHaveLength(2);
  });

  it("tightens only the shoulders that face a neighbouring notch", () => {
    // Centers 67px apart: facing shoulders must shrink, outer ones stay broad.
    const d = buildNotchedBarPath(351, 60, 24, [141.5, 208.5], GEO);
    expect(d.match(/A 26 26/g)).toHaveLength(2);
    expect(d.match(/A 16 16/g)).toHaveLength(2);
    const reachL = 141.5 + shoulderReach(26, 4, 5);
    const reachR = 208.5 - shoulderReach(26, 4, 5);
    expect(reachL).toBeLessThanOrEqual(reachR);
  });

  it("shrinks the top corner when a notch sits near the end", () => {
    const x = notchHalfWidth(GEO) + 5;
    const d = buildNotchedBarPath(360, 60, 24, [x], GEO);
    expect(d.startsWith("M 0 5")).toBe(true);
  });

  it("never emits NaN", () => {
    expect(buildNotchedBarPath(320, 58, 24, [30, 160, 290], fitNotchToSlot(GEO, 55))).not.toMatch(/NaN/);
  });
});
