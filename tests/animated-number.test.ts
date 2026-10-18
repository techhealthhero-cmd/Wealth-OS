import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const hooks = vi.hoisted(() => ({
  reducedMotion: false,
  display: undefined as number | undefined,
}));

// Retain the first render's state across the simulated hydration update.
// Effects never advance an animation frame in this regression scenario.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: number | (() => number)) => {
    hooks.display ??= typeof initial === "function" ? initial() : initial;
    return [hooks.display, vi.fn()];
  },
  useRef: () => ({ current: false }),
  useEffect: vi.fn(),
}));
vi.mock("@/lib/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: () => hooks.reducedMotion,
}));

import { AnimatedNumber } from "@/components/shared/animated-number";
import { formatMoney } from "@/lib/financial/money";

describe("AnimatedNumber reduced motion", () => {
  beforeEach(() => {
    hooks.reducedMotion = false;
    hooks.display = undefined;
  });

  it.each([
    { formatAs: "integer" as const, value: 42, expected: "42" },
    { formatAs: "percent1" as const, value: 12.5, expected: "12.5%" },
    { formatAs: "money" as const, value: 123456, expected: formatMoney(123456, "THB") },
  ])("shows the final $formatAs value when reduced motion resolves after hydration", ({ formatAs, value, expected }) => {
    const render = () => renderToStaticMarkup(AnimatedNumber({ value, formatAs, currencyCode: "THB" }));
    render(); // Server/hydration preference is false, initializing display to zero.
    expect(hooks.display).toBe(0);
    hooks.reducedMotion = true;
    expect(render()).toBe(`<span>${expected}</span>`);
    expect(hooks.display).toBe(0);
  });

  it("shows updated values immediately while reduced motion is enabled", () => {
    AnimatedNumber({ value: 42, formatAs: "integer" });
    hooks.reducedMotion = true;
    expect(renderToStaticMarkup(AnimatedNumber({ value: 99, formatAs: "integer" }))).toBe("<span>99</span>");
  });

  it("keeps the initial animated value at zero when reduced motion is disabled", () => {
    expect(renderToStaticMarkup(AnimatedNumber({ value: 42, formatAs: "integer" }))).toBe("<span>0</span>");
  });
});
