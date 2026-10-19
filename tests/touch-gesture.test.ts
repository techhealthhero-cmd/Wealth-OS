import { describe, expect, it, vi } from "vitest";
import { listenToTouchGesture } from "../src/lib/motion/touch-gesture";

describe("touch target gesture listeners", () => {
  it("binds to the original target, with a non-passive move listener", () => {
    const target = new EventTarget();
    const wrapper = new EventTarget();
    const add = vi.spyOn(target, "addEventListener");
    const move = vi.fn();
    const end = vi.fn();
    const dispose = listenToTouchGesture(target, move, end);
    expect(add.mock.calls.map(([type]) => type)).toEqual(["touchmove", "touchend", "touchcancel"]);
    expect(add.mock.calls[0][2]).toEqual({ passive: false });
    wrapper.dispatchEvent(new Event("touchmove"));
    expect(move).not.toHaveBeenCalled();
    const event = new Event("touchmove", { cancelable: true });
    Object.defineProperty(event, "touches", { value: [{ clientX: 50, clientY: 10 }] });
    target.dispatchEvent(event);
    expect(move).toHaveBeenCalledExactlyOnceWith(event);
    dispose();
  });

  it.each(["touchend", "touchcancel"])("ends on a detached target and removes listeners after %s", (type) => {
    // Independent EventTargets model a node that no longer bubbles to its wrapper.
    const target = new EventTarget();
    const wrapper = new EventTarget();
    const wrapperEnd = vi.fn();
    wrapper.addEventListener(type, wrapperEnd);
    const remove = vi.spyOn(target, "removeEventListener");
    const move = vi.fn();
    const end = vi.fn();
    listenToTouchGesture(target, move, end);
    const event = new Event(type);
    target.dispatchEvent(event);
    expect(end).toHaveBeenCalledExactlyOnceWith(event);
    expect(wrapperEnd).not.toHaveBeenCalled();
    expect(remove.mock.calls.map(([name]) => name)).toEqual(["touchmove", "touchend", "touchcancel"]);
    target.dispatchEvent(new Event("touchmove"));
    target.dispatchEvent(new Event("touchend"));
    target.dispatchEvent(new Event("touchcancel"));
    expect(move).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledTimes(1);

    // A subsequent gesture on the same target gets a fresh set of listeners.
    listenToTouchGesture(target, move, end);
    target.dispatchEvent(new Event("touchmove"));
    target.dispatchEvent(new Event("touchend"));
    expect(move).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(2);
  });

  it("removes every listener on dispose, including when disposed twice", () => {
    const target = new EventTarget();
    const remove = vi.spyOn(target, "removeEventListener");
    const move = vi.fn();
    const end = vi.fn();
    const dispose = listenToTouchGesture(target, move, end);
    dispose();
    expect(remove.mock.calls.map(([name]) => name)).toEqual(["touchmove", "touchend", "touchcancel"]);
    dispose();
    for (const type of ["touchmove", "touchend", "touchcancel"]) target.dispatchEvent(new Event(type));
    expect(move).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });
});
