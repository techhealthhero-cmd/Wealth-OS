import { describe, expect, it } from "vitest";

import {
  AI_FAB_IDLE_OPACITY_DEFAULT,
  AI_FAB_IDLE_OPACITY_MAX,
  AI_FAB_IDLE_OPACITY_MIN,
  clampIdleOpacity,
} from "@/components/layout/ai-fab-preferences";

describe("clampIdleOpacity", () => {
  it("keeps values inside the AssistiveTouch-style 15â€“100% range", () => {
    expect(clampIdleOpacity(40)).toBe(40);
    expect(clampIdleOpacity(0)).toBe(AI_FAB_IDLE_OPACITY_MIN);
    expect(clampIdleOpacity(250)).toBe(AI_FAB_IDLE_OPACITY_MAX);
  });

  it("rounds to whole percents", () => {
    expect(clampIdleOpacity(42.6)).toBe(43);
  });

  it("falls back to the default for corrupt stored values", () => {
    expect(clampIdleOpacity(Number("abc"))).toBe(AI_FAB_IDLE_OPACITY_DEFAULT);
  });
});
