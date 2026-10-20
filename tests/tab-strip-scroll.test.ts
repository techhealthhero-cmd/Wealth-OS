import { describe, expect, it } from "vitest";
import { tabStripMask, tabStripScrollTarget } from "../src/components/layout/tab-strip-scroll";

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

describe("tabStripMask", () => {
  it("does not fade rows that fit or have only subpixel overflow", () => {
    expect(tabStripMask(0, 390, 300)).toBe("none");
    expect(tabStripMask(0, 390, 391)).toBe("none");
  });
  it("fades only the edge with more tabs, including elastic overscroll", () => {
    expect(tabStripMask(-20, 390, 800)).toBe("linear-gradient(to right, black, black calc(100% - 16px), transparent)");
    expect(tabStripMask(440, 390, 800)).toBe("linear-gradient(to right, transparent, black 16px, black)");
    expect(tabStripMask(100, 390, 800)).toBe("linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)");
  });
});
