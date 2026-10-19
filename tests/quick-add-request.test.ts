import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QUICK_ADD_REQUEST_EVENT,
  isQuickAddRequestTarget,
  requestQuickAdd,
  type QuickAddRequestTarget,
} from "@/features/transactions/lib/quick-add-request";

afterEach(() => vi.unstubAllGlobals());

describe("Quick Add requests", () => {
  it.each<QuickAddRequestTarget>(["income", "capture", "scan"])("accepts %s", (target) => {
    expect(isQuickAddRequestTarget(target)).toBe(true);
  });

  it.each([undefined, null, "", "expense", "voice", "SCAN", 1, {}, ["scan"]])(
    "rejects unsupported target %j",
    (target) => expect(isQuickAddRequestTarget(target)).toBe(false),
  );

  it("dispatches scan synchronously as a cancelable event and reports handled", () => {
    const shell = new EventTarget();
    vi.stubGlobal("window", shell);
    const listener = vi.fn((event: Event) => {
      expect(event.cancelable).toBe(true);
      expect((event as CustomEvent).detail).toBe("scan");
      event.preventDefault();
    });
    shell.addEventListener(QUICK_ADD_REQUEST_EVENT, listener);

    expect(requestQuickAdd("scan")).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("returns false when no shell listener handles scan", () => {
    vi.stubGlobal("window", new EventTarget());
    expect(requestQuickAdd("scan")).toBe(false);
  });
});
