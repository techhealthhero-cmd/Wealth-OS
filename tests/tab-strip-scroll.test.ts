import { describe, expect, it } from "vitest";
import { tabStripScrollTarget } from "../src/components/layout/tab-strip-scroll";

describe("tabStripScrollTarget", () => {
  it("leaves fully visible tabs, including exact edges, alone", () => {
    expect(tabStripScrollTarget(120, 80, 100, 200, 600)).toBeNull();
    expect(tabStripScrollTarget(100, 200, 100, 200, 600)).toBeNull();
  });

  it("minimally reveals a tab clipped on the left with padding", () => {
    expect(tabStripScrollTarget(90, 80, 100, 200, 600)).toBe(82);
  });

  it("minimally reveals a tab clipped on the right with padding", () => {
    expect(tabStripScrollTarget(250, 80, 100, 200, 600)).toBe(138);
  });

  it("clamps padding at both scroll limits", () => {
    expect(tabStripScrollTarget(0, 80, 20, 200, 600)).toBe(0);
    expect(tabStripScrollTarget(520, 80, 350, 200, 600)).toBe(400);
  });

  it("never returns a negative target for a strip without overflow", () => {
    expect(tabStripScrollTarget(0, 80, 10, 200, 150)).toBe(0);
  });
});
