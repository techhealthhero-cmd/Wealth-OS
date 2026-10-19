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
      (role != null && ["button", "link", "textbox", "combobox", "dialog", "checkbox", "radio", "switch", "slider", "spinbutton", "menuitem", "tab", "listbox"].includes(role))
    ) excluded = true;
    if (node === root) return !excluded;
  }
  return false;
}

/** Minimal textarea shape: focus() + caret placement, testable without a DOM. */
interface PaperField {
  value: string;
  focus: (options?: FocusOptions) => void;
  setSelectionRange: (start: number, end: number) => void;
}

/**
 * Puts the caret at the end of the paper. Must run synchronously inside the
 * tap's touchend/click handler (never in a timeout, rAF or after a state update):
 * iOS Safari only raises the keyboard for a focus() made during the gesture.
 */
export function focusPaperEnd(el: PaperField | null): boolean {
  if (!el) return false;
  el.focus({ preventScroll: true });
  const end = el.value.length;
  el.setSelectionRange(end, end);
  return true;
}

export interface PaperTouchPoint { identifier: number; clientX: number; clientY: number }

/** Reject multi-touch and any excursion over 10px, even if the finger returns. */
export function isPaperTap(start: PaperTouchPoint | null, touches: ArrayLike<PaperTouchPoint>): boolean {
  if (!start || touches.length !== 1) return false;
  const end = touches[0];
  return start.identifier === end.identifier &&
    Math.hypot(end.clientX - start.clientX, end.clientY - start.clientY) <= 10;
}
