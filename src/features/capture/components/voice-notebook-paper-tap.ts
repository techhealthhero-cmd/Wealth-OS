/** Minimal DOM shape keeps this target policy testable without a portal or browser. */
interface PaperTapNode {
  nodeName: string;
  parentNode: PaperTapNode | null;
  getAttribute?: (name: string) => string | null;
}

const excludedTags = new Set([
  "LI", "BUTTON", "INPUT", "SELECT", "OPTION", "LABEL", "A", "TEXTAREA", "FORM",
  "SUMMARY", "DETAILS", "AUDIO", "VIDEO",
]);

export function isEmptyPaperTapTarget(target: PaperTapNode | null, root: PaperTapNode): boolean {
  let excluded = false;
  for (let node = target; node; node = node.parentNode) {
    const role = node.getAttribute?.("role");
    if (
      excludedTags.has(node.nodeName.toUpperCase()) ||
      (node.getAttribute?.("contenteditable") != null && node.getAttribute?.("contenteditable") !== "false") ||
      (role != null && ["button", "link", "textbox", "combobox", "dialog"].includes(role))
    ) excluded = true;
    if (node === root) return !excluded;
  }
  return false;
}
