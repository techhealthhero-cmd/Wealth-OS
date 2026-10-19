/** Static paper copy: prune only vertically invisible branches, preserving their layout boxes.
 * Reads live rectangles only; all writes are to detached nodes. Depth bounds layout reads.
 */
export function viewportClone<T extends Element>(live: T, viewport: { top: number; bottom: number }, maxDepth = 6): T {
  const heavySelector = "video, iframe, canvas";
  function placeholder(node: Element, rect: DOMRect): Element {
    const heavy = node.matches(heavySelector);
    const copy = heavy ? node.ownerDocument.createElement("div") : node.cloneNode(false) as Element;
    if (heavy) {
      for (const attr of Array.from(node.attributes)) {
        if (attr.name === "class" || attr.name === "style") copy.setAttribute(attr.name, attr.value);
      }
    }
    Object.assign((copy as HTMLElement).style, {
      height: `${rect.height}px`, boxSizing: "border-box", overflow: "hidden",
      ...(heavy ? { width: `${rect.width}px` } : {}),
    });
    copy.removeAttribute("id");
    return copy;
  }
  function pinStripScroll(node: Element, copy: Element) {
    // cloneNode resets scrollLeft. Freeze the tab strip's content offset in
    // detached paper so saved clones also retain it without layout writes.
    if (node.matches("nav") && node.scrollLeft && copy.firstElementChild) {
      (copy.firstElementChild as HTMLElement).style.translate = `${-node.scrollLeft}px 0`;
    }
  }
  function deep(node: Element): Element {
    const copy = node.cloneNode(true) as Element;
    // Match before replacement so nested media (e.g. video fallback) cannot shift indices.
    const originals = Array.from(node.querySelectorAll(heavySelector));
    const copies = Array.from(copy.querySelectorAll(heavySelector));
    copies.forEach((media, i) => media.replaceWith(placeholder(originals[i], originals[i].getBoundingClientRect())));
    pinStripScroll(node, copy);
    const strips = Array.from(node.querySelectorAll("nav"));
    copy.querySelectorAll("nav").forEach((strip, i) => pinStripScroll(strips[i], strip));
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach((child) => child.removeAttribute("id"));
    return copy;
  }
  function visit(node: Element, depth: number): Element {
    const rect = node.getBoundingClientRect();
    if (node.matches(heavySelector) || rect.bottom <= viewport.top || rect.top >= viewport.bottom) return placeholder(node, rect);
    if ((rect.top >= viewport.top && rect.bottom <= viewport.bottom) || depth >= maxDepth) return deep(node);
    const copy = node.cloneNode(false) as Element;
    copy.removeAttribute("id");
    for (const child of Array.from(node.childNodes)) {
      copy.appendChild(child.nodeType === 1 ? visit(child as Element, depth + 1) : child.cloneNode(true));
    }
    pinStripScroll(node, copy);
    return copy;
  }
  return visit(live, 0) as T;
}
