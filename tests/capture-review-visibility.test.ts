import { describe, expect, it } from "vitest";
import { reviewScrollDelta } from "@/features/capture/lib/review-visibility";

describe("capture review action visibility", () => {
  it("leaves a fitting review at scrollTop zero with a 34px safe area", () => {
    expect(reviewScrollDelta(664 - 34 - 12, 584)).toBe(0);
  });
  it("reveals only the clipped part of a tall review", () => {
    expect(reviewScrollDelta(618, 644)).toBe(26);
  });
  it("preserves user scrolling when the action is above the viewport", () => {
    expect(reviewScrollDelta(618, 164)).toBe(0);
  });
  it("does not scroll at either visible boundary", () => {
    expect(reviewScrollDelta(618, 194)).toBe(0);
    expect(reviewScrollDelta(618, 618)).toBe(0);
  });
});
