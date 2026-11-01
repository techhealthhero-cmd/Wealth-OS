import { afterEach, describe, expect, it } from "vitest";

import { restoreWindowScroll } from "@/features/transactions/components/list-tabs";

function installScroll(scrollHeight: number, clientHeight: number, scrollY = 0) {
  const state = { scrollY, behavior: "" };
  const element = {
    scrollHeight,
    clientHeight,
    style: {
      get scrollBehavior() {
        return state.behavior;
      },
      set scrollBehavior(value: string) {
        state.behavior = value;
      },
    },
  };
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  Object.assign(globalThis, {
    window: {
      get scrollY() {
        return state.scrollY;
      },
      scrollTo(_x: number, y: number) {
        state.scrollY = y;
      },
    },
    document: { documentElement: element },
  });
  return {
    state,
    restore() {
      if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else globalThis.window = previousWindow;
      if (previousDocument === undefined) delete (globalThis as { document?: unknown }).document;
      else globalThis.document = previousDocument;
    },
  };
}

describe("restoreWindowScroll", () => {
  let restore: (() => void) | null = null;
  afterEach(() => restore?.());

  it("scrolls back to the captured offset when the page is tall enough", () => {
    const env = installScroll(2400, 844, 0);
    restore = env.restore;
    expect(restoreWindowScroll(360)).toBe(true);
    expect(env.state.scrollY).toBe(360);
    expect(env.state.behavior).toBe("");
  });

  it("does not move the window when it is already there", () => {
    const env = installScroll(2400, 844, 360);
    restore = env.restore;
    let moved = false;
    globalThis.window.scrollTo = () => {
      moved = true;
    };
    expect(restoreWindowScroll(360)).toBe(true);
    expect(moved).toBe(false);
  });

  it("clamps and reports that a short page cannot reach the old offset yet", () => {
    const env = installScroll(900, 844, 0);
    restore = env.restore;
    expect(restoreWindowScroll(360)).toBe(false);
    expect(env.state.scrollY).toBe(56);
  });
});
