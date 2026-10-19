import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { focusPaperEnd, isEmptyPaperTapTarget, isPaperTap } from "../src/features/capture/components/voice-notebook-paper-tap";

// Small DOM-shaped trees exercise the pure ancestor policy in Vitest's Node environment.
class TapNode {
  constructor(
    readonly nodeName: string,
    readonly parentNode: TapNode | null = null,
    private readonly attributes: Record<string, string> = {},
  ) {}
  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }
}

describe("isEmptyPaperTapTarget", () => {
  const root = new TapNode("DIV");

  it("accepts the paper root and its status paragraph", () => {
    expect(isEmptyPaperTapTarget(root, root)).toBe(true);
    expect(isEmptyPaperTapTarget(new TapNode("P", root), root)).toBe(true);
  });

  it.each(["BUTTON", "INPUT", "LI", "TEXTAREA", "FORM", "SELECT", "LABEL", "A"])(
    "excludes %s and its nested content",
    (tag) => {
      const control = new TapNode(tag, root);
      expect(isEmptyPaperTapTarget(control, root)).toBe(false);
      expect(isEmptyPaperTapTarget(new TapNode("SPAN", control), root)).toBe(false);
    },
  );

  it("rejects targets outside the root and missing targets", () => {
    expect(isEmptyPaperTapTarget(new TapNode("P"), root)).toBe(false);
    expect(isEmptyPaperTapTarget(null, root)).toBe(false);
  });

  it.each(["button", "link", "textbox", "combobox", "dialog", "checkbox", "switch", "slider", "menuitem", "tab"])("excludes role=%s descendants", (role) => {
    expect(isEmptyPaperTapTarget(new TapNode("SPAN", new TapNode("DIV", root, { role })), root)).toBe(false);
  });

  it("excludes editable content and custom controls", () => {
    expect(isEmptyPaperTapTarget(new TapNode("DIV", root, { contenteditable: "" }), root)).toBe(false);
    expect(isEmptyPaperTapTarget(new TapNode("DIV", root, { role: "button" }), root)).toBe(false);
  });
});

describe("focusPaperEnd", () => {
  it("focuses synchronously and puts the caret after the last letter", () => {
    const calls: string[] = [];
    const el = {
      value: "กาแฟ 80",
      focus: vi.fn(() => calls.push("focus")),
      setSelectionRange: vi.fn((start: number, end: number) => calls.push(`caret:${start}-${end}`)),
    };
    expect(focusPaperEnd(el)).toBe(true);
    // Both happen before returning — never deferred out of the tap's gesture.
    expect(calls).toEqual(["focus", "caret:7-7"]);
  });

  it("is a no-op before the paper mounts", () => {
    expect(focusPaperEnd(null)).toBe(false);
  });
});

describe("paper touch movement", () => {
  const start = { identifier: 1, clientX: 30, clientY: 40 };
  it("accepts a stationary tap and the 10px boundary", () => {
    expect(isPaperTap(start, [start])).toBe(true);
    expect(isPaperTap(start, [{ ...start, clientY: 50 }])).toBe(true);
  });
  it("rejects scrolling, diagonal drags, cancelled starts and multiple fingers", () => {
    expect(isPaperTap(start, [{ ...start, clientY: 51 }])).toBe(false);
    expect(isPaperTap(start, [{ ...start, clientX: 38, clientY: 48 }])).toBe(false);
    expect(isPaperTap(null, [start])).toBe(false);
    expect(isPaperTap(start, [start, start])).toBe(false);
    expect(isPaperTap(start, [])).toBe(false);
    expect(isPaperTap(start, [{ ...start, identifier: 2 }])).toBe(false);
  });
});

describe("voice notebook gesture wiring", () => {
  const source = readFileSync(resolve(__dirname, "../src/features/capture/components/voice-notebook.tsx"), "utf8");
  it("uses a cancellable native touchend and preserves desktop fallback", () => {
    expect(source).toContain('area.addEventListener("touchend", end, { passive: false })');
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain('area.addEventListener("touchmove", move, { passive: true })');
    expect(source).toContain('onClick={() => focusPaperEnd(paperRef.current)}');
  });
});
