import { describe, expect, it } from "vitest";

import { scrubIndexFromClientX } from "@/features/dashboard/components/net-worth-mini-chart";

// 304px wide box starting at x=100 → plot area is x=102..402 (2px margins).
const rect = { left: 100, width: 304 };

describe("scrubIndexFromClientX", () => {
  it("maps the plot edges to the first and last point", () => {
    expect(scrubIndexFromClientX(102, rect, 7)).toBe(0);
    expect(scrubIndexFromClientX(402, rect, 7)).toBe(6);
  });

  it("picks the nearest point in between", () => {
    // 7 points → one every 50px.
    expect(scrubIndexFromClientX(152, rect, 7)).toBe(1);
    expect(scrubIndexFromClientX(176, rect, 7)).toBe(1);
    expect(scrubIndexFromClientX(178, rect, 7)).toBe(2);
  });

  it("clamps a finger dragged past either side of the chart", () => {
    expect(scrubIndexFromClientX(-500, rect, 7)).toBe(0);
    expect(scrubIndexFromClientX(5000, rect, 7)).toBe(6);
  });

  it("handles degenerate sizes without NaN", () => {
    expect(scrubIndexFromClientX(150, rect, 1)).toBe(0);
    expect(scrubIndexFromClientX(150, { left: 0, width: 0 }, 5)).toBe(0);
  });
});
