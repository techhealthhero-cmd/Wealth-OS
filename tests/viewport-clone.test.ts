import { describe, expect, it } from "vitest";
import { viewportClone } from "../src/lib/motion/viewport-clone";

// Dependency-free DOM double; the helper also runs in jsdom with mocked live rects.
class TestElement {
  nodeType = 1;
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  childNodes: TestElement[] = [];
  parent: TestElement | null = null;
  reads = 0;
  scrollLeft = 0;
  get firstElementChild() { return this.childNodes[0] ?? null; }
  ownerDocument = { createElement: (tag: string) => new TestElement(tag) };
  constructor(public tag = "div", public top = 0, public bottom = 100) {}
  get attributes() { return Object.entries(this.attrs).map(([name, value]) => ({ name, value })); }
  getBoundingClientRect() { this.reads++; return { top: this.top, bottom: this.bottom, height: this.bottom - this.top, width: 320 }; }
  matches(selector: string) { return selector.split(", ").includes(this.tag); }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  removeAttribute(name: string) { delete this.attrs[name]; }
  appendChild(child: TestElement) { this.childNodes.push(child); child.parent = this; return child; }
  cloneNode(deep: boolean): TestElement {
    const copy = new TestElement(this.tag, this.top, this.bottom);
    copy.attrs = { ...this.attrs };
    copy.style = { ...this.style };
    if (deep) this.childNodes.forEach((child) => copy.appendChild(child.cloneNode(true)));
    return copy;
  }
  querySelectorAll(selector: string): TestElement[] {
    return this.childNodes.flatMap((child) => [
      ...(selector === "[id]" ? "id" in child.attrs : child.matches(selector)) ? [child] : [],
      ...child.querySelectorAll(selector),
    ]);
  }
  replaceWith(copy: TestElement) {
    if (this.parent) { this.parent.childNodes[this.parent.childNodes.indexOf(this)] = copy; copy.parent = this.parent; }
  }
}
const clone = (live: TestElement, depth?: number) => viewportClone(live as unknown as HTMLElement, { top: 0, bottom: 500 }, depth) as unknown as TestElement;
const node = (top: number, bottom: number, ...children: TestElement[]) => {
  const el = new TestElement("div", top, bottom);
  children.forEach((child) => el.appendChild(child));
  return el;
};

describe("viewportClone", () => {
  it("deep clones fully visible branches without measuring descendants", () => {
    const child = node(20, 30, node(22, 25));
    const live = node(0, 100, child);
    const copy = clone(live);
    expect(copy.childNodes[0].childNodes).toHaveLength(1);
    expect(copy.childNodes[0]).not.toBe(child);
    expect(child.reads).toBe(0);
  });
  it.each([[-200, -10], [500, 900]])("replaces offscreen subtree %s..%s with its outer box", (top, bottom) => {
    const live = node(top, bottom, node(top, bottom));
    live.attrs.class = "mt-4 flex-1";
    const copy = clone(live);
    expect(copy.childNodes).toHaveLength(0);
    expect(copy.attrs.class).toBe(live.attrs.class);
    expect(copy.style).toMatchObject({ height: `${bottom - top}px`, boxSizing: "border-box", overflow: "hidden" });
    expect(live.childNodes).toHaveLength(1);
  });
  it("descends partially visible branches and preserves child positions", () => {
    const copy = clone(node(-100, 900, node(-100, -20, node(-80, -30)), node(20, 100, node(30, 40)), node(490, 700, node(600, 700))));
    expect(copy.childNodes.map((child) => child.childNodes.length)).toEqual([0, 1, 1]);
    expect(copy.childNodes[2].childNodes[0].style.height).toBe("100px");
  });
  it("removes root and nested ids in deep and descended branches", () => {
    const live = node(-1, 600, node(10, 100, node(20, 30)));
    [live, ...live.childNodes, live.childNodes[0].childNodes[0]].forEach((el) => el.attrs.id = "duplicate");
    const copy = clone(live);
    expect(copy.attrs.id).toBeUndefined();
    expect(copy.querySelectorAll("[id]")).toHaveLength(0);
    expect(live.attrs.id).toBe("duplicate");
  });
  it.each(["video", "iframe", "canvas"])("replaces %s even inside a deeply cloned visible branch", (tag) => {
    const media = new TestElement(tag, 10, 90);
    media.attrs = { class: "rounded", src: "expensive", id: "media" };
    const copy = clone(node(0, 100, media)).childNodes[0];
    expect(copy.tag).toBe("div");
    expect(copy.attrs).toEqual({ class: "rounded" });
    expect(copy.style).toMatchObject({ height: "80px", width: "320px" });
  });
  it("pins a horizontally scrolled tab strip in both visible and partial branches", () => {
    for (const bottom of [100, 600]) {
      const strip = new TestElement("nav", 10, bottom);
      strip.scrollLeft = 120;
      strip.appendChild(node(10, 100));
      const copy = clone(node(0, bottom, strip));
      expect(copy.childNodes[0].childNodes[0].style.translate).toBe("-120px 0");
      expect(strip.childNodes[0].style.translate).toBeUndefined();
    }
  });
  it("bounds descent and falls back to deep cloning with sanitation", () => {
    const leaf = node(700, 900, new TestElement("canvas", 710, 800));
    const live = node(-10, 1000, node(-10, 1000, leaf));
    const copy = clone(live, 1);
    expect(copy.childNodes[0].childNodes[0].childNodes[0].tag).toBe("div");
    expect(leaf.reads).toBe(0);
  });
});
