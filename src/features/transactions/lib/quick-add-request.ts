/**
 * Lets any page open the app shell's one Quick Add instance (the bottom
 * nav's center mic, see quick-add.tsx variant "nav-center") without
 * mounting a second copy of its forms/sheets. Home's quick actions use it:
 * "income" opens the existing income form, "capture" opens Quick Capture
 * (type, talk, or scan a slip/receipt).
 *
 * The listener lives in BottomNav, which the (app) layout always renders
 * (on desktop it is only hidden with CSS, still mounted). The event is
 * cancelable and the listener cancels it to say "handled", so a caller can
 * still fall back if it ever runs somewhere without that shell.
 */
export const QUICK_ADD_REQUEST_EVENT = "wealthos:quick-add-request";

export type QuickAddRequestTarget = "income" | "capture";

/** Returns true when the shell's Quick Add picked the request up. */
export function requestQuickAdd(target: QuickAddRequestTarget): boolean {
  const event = new CustomEvent<QuickAddRequestTarget>(QUICK_ADD_REQUEST_EVENT, { detail: target, cancelable: true });
  return !window.dispatchEvent(event);
}

export function isQuickAddRequestTarget(value: unknown): value is QuickAddRequestTarget {
  return value === "income" || value === "capture";
}
