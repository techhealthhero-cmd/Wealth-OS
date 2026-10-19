import { describe, expect, it } from "vitest";
import { sheetGeometry } from "../src/lib/motion/page-curl";

describe("whole-main sheet geometry (all turn callers)", () => {
  it("includes the section title and tabs and continues behind bottom navigation", () => {
    expect(sheetGeometry({ top: 64, left: 20, width: 390 }, 844)).toEqual({ top: 64, left: 20, width: 390, height: 780, backgroundOffsetY: 0 });
  });
  it("clips scrolled main at the viewport and keeps paper rules aligned", () => {
    expect(sheetGeometry({ top: -137, left: 0, width: 390 }, 844)).toEqual({ top: 0, left: 0, width: 390, height: 844, backgroundOffsetY: -137 });
  });
  it("uses the same origin on Home without a tab strip", () => {
    const geometry = sheetGeometry({ top: 72, left: 0, width: 420 }, 900);
    expect(geometry.top + geometry.height).toBe(900);
    expect(geometry.top + geometry.backgroundOffsetY).toBe(72);
  });
});
