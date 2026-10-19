import { describe, expect, it } from "vitest";
import { isEmptyPaperTapTarget } from "../src/features/capture/components/voice-notebook-paper-tap";

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
