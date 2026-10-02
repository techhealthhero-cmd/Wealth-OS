"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Pulled down this far below its resting height, releasing closes the sheet. */
const DISMISS_DISTANCE = 110;
/** A quick flick also counts (px per ms). */
const FLICK_VELOCITY = 0.5;
const FLICK_MIN_DISTANCE = 40;
/** Downward travel that drops the keyboard (like Instagram chat). */
const KEYBOARD_DISMISS_DISTANCE = 10;
const SETTLE_MS = 220;

function isEditable(el: Element | null): el is HTMLElement {
  return !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable);
}

/**
 * Free-moving bottom sheet, chat-app style:
 *
 * - Content always scrolls natively in its own area — the sheet never locks.
 * - With the keyboard up, any downward swipe first drops the keyboard
 *   (blurs the field) instead of closing anything, as in Instagram DMs.
 * - The window itself follows the finger: pull it up to expand to near
 *   full height, pull it down to shrink back, keep pulling to close.
 *   It only takes over a gesture that can't be a scroll — one started on
 *   the handle/header, or on content already at its top (pulling down) or
 *   bottom (pulling up).
 *
 * Native non-passive listeners let the sheet suppress the browser's own
 * rubber-band scroll while it is being dragged.
 */
export function useSwipeToDismiss({ enabled, onDismiss }: { enabled: boolean; onDismiss: () => void }) {
  const sheetElRef = useRef<HTMLElement | null>(null);
  // Bumped when the sheet element mounts, so listeners attach to the real node.
  const [mountKey, setMountKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const node = sheetElRef.current;
    if (!enabled || !node) return;
    const sheet: HTMLElement = node;
    // Every opening starts collapsed, at the resting position.
    sheet.style.transform = "";
    sheet.style.transition = "";
    sheet.style.height = "";
    let isExpanded = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const settle = reducedMotion ? "none" : `transform ${SETTLE_MS}ms ease-out, height ${SETTLE_MS}ms ease-out`;

    let startY = 0;
    let startTime = 0;
    let startHeight = 0;
    let collapsedHeight = 0;
    let maxHeight = 0;
    let mode: "undecided" | "scroll" | "drag" = "undecided";
    let startedOnContent = false;
    let keyboardDropped = false;
    let currentHeight = 0;
    let pullOffset = 0;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;

    function maxSheetHeight() {
      // Room above the keyboard when it's up; otherwise 92% of the screen.
      const vv = window.visualViewport;
      return Math.round((vv ? vv.height : window.innerHeight) * 0.92);
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      clearTimeout(clearTimer);
      const scroller = scrollRef.current;
      startedOnContent = !!scroller && scroller.contains(e.target as Node);
      mode = "undecided";
      keyboardDropped = false;
      startY = e.touches[0].clientY;
      startTime = performance.now();
      startHeight = sheet.offsetHeight;
      if (!isExpanded) collapsedHeight = startHeight;
      maxHeight = Math.max(startHeight, maxSheetHeight());
      currentHeight = startHeight;
      pullOffset = 0;
    }

    function onMove(e: TouchEvent) {
      const dy = e.touches[0].clientY - startY;

      // Chat-style: swiping down drops the keyboard first, never closes.
      const focused = document.activeElement;
      if (!keyboardDropped && dy > KEYBOARD_DISMISS_DISTANCE && isEditable(focused) && sheet.contains(focused)) {
        keyboardDropped = true;
        focused.blur();
        mode = "scroll";
        return;
      }
      if (keyboardDropped || mode === "scroll") return;

      if (mode === "undecided") {
        if (Math.abs(dy) < 6) return;
        const scroller = scrollRef.current;
        const atTop = !scroller || scroller.scrollTop <= 0;
        const atBottom = !scroller || scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        const canGrow = !isExpanded && maxHeight - startHeight > 24;
        const sheetTakesIt = dy > 0 ? !startedOnContent || atTop : canGrow && (!startedOnContent || atBottom);
        if (!sheetTakesIt) {
          mode = "scroll";
          return;
        }
        mode = "drag";
        sheet.style.transition = "none";
      }

      // Follow the finger: height between collapsed and max; below
      // collapsed, the whole sheet slides down.
      const target = startHeight - dy;
      if (target >= collapsedHeight) {
        currentHeight = Math.min(target, maxHeight);
        pullOffset = 0;
        sheet.style.height = `${currentHeight}px`;
        sheet.style.transform = "";
      } else {
        currentHeight = collapsedHeight;
        pullOffset = collapsedHeight - target;
        sheet.style.height = `${collapsedHeight}px`;
        sheet.style.transform = `translateY(${pullOffset}px)`;
      }
      if (e.cancelable) e.preventDefault();
    }

    function onEnd() {
      if (mode !== "drag") {
        mode = "undecided";
        return;
      }
      mode = "undecided";
      const elapsed = Math.max(1, performance.now() - startTime);
      const velocity = (startHeight - currentHeight + pullOffset) / elapsed; // + = downward
      sheet.style.transition = settle;

      if (pullOffset > DISMISS_DISTANCE || (pullOffset > FLICK_MIN_DISTANCE && velocity > FLICK_VELOCITY)) {
        sheet.style.transform = `translateY(${sheet.offsetHeight}px)`;
        onDismissRef.current();
        return;
      }
      sheet.style.transform = "";
      const midpoint = (collapsedHeight + maxHeight) / 2;
      const expand = velocity < -FLICK_VELOCITY || (velocity <= FLICK_VELOCITY && currentHeight > midpoint);
      if (expand && maxHeight - collapsedHeight > 24) {
        isExpanded = true;
        setExpanded(true);
        sheet.style.height = `${maxHeight}px`;
      } else {
        isExpanded = false;
        setExpanded(false);
        sheet.style.height = `${collapsedHeight}px`;
      }
      // After settling: hand transitions back to the stylesheet (so the sheet
      // glides with the keyboard again) and, when collapsed, return to its
      // natural height so new content can resize it.
      clearTimer = setTimeout(() => {
        sheet.style.transition = "";
        if (!isExpanded) sheet.style.height = "";
      }, SETTLE_MS + 20);
    }

    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd);
    sheet.addEventListener("touchcancel", onEnd);
    return () => {
      clearTimeout(clearTimer);
      setExpanded(false);
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
      sheet.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, mountKey]);

  const sheetRef = useCallback((el: HTMLElement | null) => {
    sheetElRef.current = el;
    if (el) setMountKey((k) => k + 1);
  }, []);
  return { sheetRef, scrollRef, expanded };
}
