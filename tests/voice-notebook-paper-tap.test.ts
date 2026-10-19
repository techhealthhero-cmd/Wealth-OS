import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { focusPaperEnd, isEmptyPaperTapTarget } from "../src/features/capture/components/voice-notebook-paper-tap";

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

// iOS Safari regression (PR #34 focused on pointerdown; the tap's own
// mousedown on the blank paper then blurred the textarea, so the keyboard
// never opened). Keep the focus in the click, synchronously, everywhere.
describe("voice notebook paper focus wiring", () => {
  const source = readFileSync(resolve(__dirname, "../src/features/capture/components/voice-notebook.tsx"), "utf8");
  const paper = source.slice(source.indexOf('data-testid="voice-paper"'), source.indexOf("<textarea"))
    .replace(/^\s*\/\/.*$/gm, ""); // the code only, not its explanation

  it("focuses the blank paper from onClick, not pointerdown, with no preventDefault", () => {
    expect(paper).toContain("onClick={(event) =>");
    expect(paper).toContain("focusPaperEnd(paperRef.current)");
    expect(paper).not.toMatch(/onPointerDown|onTouchStart|onMouseDown/);
    expect(paper).not.toMatch(/preventDefault|setTimeout|requestAnimationFrame/);
  });

  it("the พิมพ์เอง button focuses inside its own click", () => {
    expect(source).toMatch(/onClick=\{\(\) => focusPaperEnd\(paperRef\.current\)\}/);
  });
});
