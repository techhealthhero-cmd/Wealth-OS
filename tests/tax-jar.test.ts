import { describe, expect, it } from "vitest";
import { calculateSetAside, jarProgress, TAX_JAR_DEFAULT_RATE_PCT, TAX_JAR_SUGGESTED_RATES } from "@/lib/financial/tax-jar";

describe("tax jar", () => {
  it("provides suggested rates and sets aside 7% by default", () => {
    expect(TAX_JAR_SUGGESTED_RATES).toEqual([5, 7, 10]);
    expect(TAX_JAR_DEFAULT_RATE_PCT).toBe(7);
    expect(calculateSetAside(10000, 7)).toBe(700);
    expect(calculateSetAside(10000)).toBe(700);
    expect(calculateSetAside(1, 50)).toBe(1);
    expect(calculateSetAside(10000, 0)).toBe(0);
  });
  it.each([-1, 51, NaN, Infinity])("rejects invalid rate %s", rate => {
    expect(() => calculateSetAside(10000, rate)).toThrow();
  });
  it.each([-1, NaN, Infinity, 1.5])("rejects invalid income %s", income => {
    expect(() => calculateSetAside(income, 7)).toThrow();
  });
  it("reports a shortfall and percentage coverage", () => {
    const progress = jarProgress(14800, 18600);
    expect(progress.pct).toBeCloseTo(79.57, 2);
    expect(progress).toMatchObject({ shortfallCents: 3800, surplusCents: 0, onTrack: false });
  });
  it("caps coverage and reports surplus or exact funding", () => {
    expect(jarProgress(200, 100)).toEqual({ pct: 100, shortfallCents: 0, surplusCents: 100, onTrack: true });
    expect(jarProgress(100, 100)).toEqual({ pct: 100, shortfallCents: 0, surplusCents: 0, onTrack: true });
    expect(jarProgress(0, 100).pct).toBe(0);
    expect(jarProgress(-100, 100).pct).toBe(0);
  });
  it.each([0, -100])("treats non-positive due %s as funded", due => {
    expect(jarProgress(100, due)).toEqual({ pct: 100, shortfallCents: 0, surplusCents: 100, onTrack: true });
  });
});
