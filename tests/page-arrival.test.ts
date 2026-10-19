import { afterEach, expect, it, vi } from "vitest";
import { finishPageAnimations, waitForNoSkeleton } from "../src/lib/motion/page-arrival";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function fallback() {
  let skeleton = true;
  let changed = () => {};
  const disconnect = vi.fn();
  const observe = vi.fn();
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: () => void) { changed = callback; }
    disconnect = disconnect;
    observe = observe;
  });
  const el = { querySelector: () => skeleton ? {} : null } as unknown as HTMLElement;
  return { el, disconnect, observe, clear: () => { skeleton = false; changed(); }, changed: () => changed() };
}

it("waits for the final skeleton removal and disposes observation and cap", () => {
  vi.useFakeTimers();
  const f = fallback();
  const ready = vi.fn();
  waitForNoSkeleton(f.el, ready, 900);
  expect(f.observe).toHaveBeenCalledWith(f.el, { subtree: true, childList: true });
  f.changed();
  expect(ready).not.toHaveBeenCalled();
  f.clear();
  vi.runAllTimers();
  expect(ready).toHaveBeenCalledTimes(1);
  expect(f.disconnect).toHaveBeenCalledOnce();
});

it("releases at the cap and ignores later mutation delivery", () => {
  vi.useFakeTimers();
  const f = fallback();
  const ready = vi.fn();
  waitForNoSkeleton(f.el, ready, 900);
  vi.advanceTimersByTime(899);
  expect(ready).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  f.clear();
  expect(ready).toHaveBeenCalledOnce();
  expect(f.disconnect).toHaveBeenCalledOnce();
});

it("cancels a superseded or unmounted wait", () => {
  vi.useFakeTimers();
  const f = fallback();
  const ready = vi.fn();
  const cancel = waitForNoSkeleton(f.el, ready, 900);
  cancel();
  f.clear();
  vi.runAllTimers();
  expect(ready).not.toHaveBeenCalled();
});

it("releases ready content immediately", () => {
  const ready = vi.fn();
  waitForNoSkeleton({ querySelector: () => null } as unknown as HTMLElement, ready, 900)();
  expect(ready).toHaveBeenCalledOnce();
});

it("finishes only running finite CSS animations and tolerates missing APIs", () => {
  const make = (iterations: number, playState = "running", css = true) => ({
    ...(css ? { animationName: "reveal" } : {}), playState,
    effect: { getTiming: () => ({ iterations }) }, finish: vi.fn(),
  });
  const animations = [make(1), make(Infinity), make(1, "finished"), make(1, "running", false)];
  const getAnimations = vi.fn(() => animations);
  finishPageAnimations({ getAnimations } as unknown as HTMLElement);
  expect(getAnimations).toHaveBeenCalledWith({ subtree: true });
  animations.forEach((animation, i) => expect(animation.finish).toHaveBeenCalledTimes(i === 0 ? 1 : 0));
  expect(() => finishPageAnimations({} as HTMLElement)).not.toThrow();
});
