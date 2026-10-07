"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import { useRouter } from "next/navigation";

import { prefersReducedMotion } from "@/lib/motion/black-hole";

// Same commit distance / axis dead-zone the old app-wide tab swipe used.
const SWIPE_THRESHOLD_PX = 60;
const AXIS_LOCK_PX = 10;
// How far the content follows the finger while dragging (a hint, not 1:1).
const DRAG_FOLLOW = 0.18;
const FLIP_MS = 560;
const FLIP_EASE = "cubic-bezier(0.45, 0.05, 0.35, 1)";
const PERSPECTIVE = "perspective(1600px)";
// If the new page never arrives (navigation failed), stop waiting for it.
const MAX_WAIT_MS = 5000;

/** +1 = next page (forward), -1 = previous page (back). */
export type PageFlipDirection = 1 | -1;

export interface SwipeTabPagesHandle {
  /** Snapshot the current page so it can flip once the new page arrives — call right before navigating. */
  beginFlip: (dir: PageFlipDirection) => void;
}

interface PendingFlip {
  dir: PageFlipDirection;
  overlay: HTMLDivElement;
  page: HTMLElement;
  timer: number;
}

/**
 * Elements that own horizontal drags themselves: native horizontal
 * scrollers (overflow-x auto/scroll only — an `overflow-x: hidden` parent
 * with wide content is not touch-scrollable), swipe-to-delete rows
 * (`data-no-swipe-nav`), form controls, and charts (drag = scrub tooltip).
 */
function ownsHorizontalDrag(
  target: EventTarget | null,
  boundary: HTMLElement,
): boolean {
  if (!(target instanceof Element)) return false;
  if (
    target.closest(
      "[data-no-swipe-nav], input, textarea, select, [role='slider'], .recharts-wrapper",
    )
  )
    return true;
  let node: Element | null = target;
  while (node && node !== boundary) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** Vertical center of the on-screen part of `rect`, in the element's own coordinates — the flip's hinge point. */
function visibleHinge(rect: DOMRect): {
  y: number;
  clipTop: number;
  clipBottom: number;
} {
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  return {
    y: (top + bottom) / 2 - rect.top,
    clipTop: top - rect.top,
    clipBottom: Math.max(rect.bottom - bottom, 0),
  };
}

/**
 * Wraps a section's page content (Money / Plan / Earn) so a horizontal
 * swipe moves to the next/previous tab — requested 2026-10-08 — with a
 * book page-turn: going forward, the current page lifts at its right edge
 * and turns over toward the spine (left edge), revealing the next page;
 * going back, the previous page turns back over from the left.
 *
 * The old page is snapshotted (a DOM clone in a fixed overlay) at the
 * moment of navigation, and only flips once the new page has actually
 * rendered — so a slow route never reveals the same old page underneath,
 * and tapping a tab (SegmentedTabs calls `beginFlip`) gets the same turn.
 */
export function SwipeTabPages({
  hrefs,
  activeIndex,
  children,
  handleRef,
}: {
  hrefs: string[];
  activeIndex: number;
  children: ReactNode;
  handleRef?: Ref<SwipeTabPagesHandle>;
}) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingFlip | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const hrefsRef = useRef(hrefs);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
    hrefsRef.current = hrefs;
  });

  function resetWrapper() {
    const el = wrapperRef.current;
    if (!el) return;
    el.style.opacity = "";
    el.style.transform = "";
    el.style.transformOrigin = "";
    el.style.transition = "";
    el.style.background = "";
    el.style.boxShadow = "";
    el.style.borderRadius = "";
  }

  function clearPending() {
    const pending = pendingRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pending.overlay.remove();
    pendingRef.current = null;
    resetWrapper();
  }

  function beginFlip(dir: PageFlipDirection) {
    clearPending();
    const el = wrapperRef.current;
    if (!el || prefersReducedMotion()) return;
    el.style.transition = "";
    el.style.transform = "";
    const rect = el.getBoundingClientRect();
    const { clipTop, clipBottom } = visibleHinge(rect);
    if (rect.height - clipTop - clipBottom <= 0) return;

    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      zIndex: "20",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);

    const page = el.cloneNode(true) as HTMLElement;
    page.removeAttribute("id");
    page.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    Object.assign(page.style, {
      position: "absolute",
      inset: "0",
      margin: "0",
      background: "var(--background)",
      borderRadius: "1rem",
      clipPath: `inset(${clipTop}px 0 ${clipBottom}px 0)`,
      backfaceVisibility: "hidden",
      willChange: "transform",
    } satisfies Partial<CSSStyleDeclaration>);
    overlay.appendChild(page);
    document.body.appendChild(overlay);

    // The snapshot now stands in for the live page until the new one renders.
    el.style.opacity = "0";
    pendingRef.current = {
      dir,
      overlay,
      page,
      timer: window.setTimeout(clearPending, MAX_WAIT_MS),
    };
  }

  useImperativeHandle(handleRef, () => ({ beginFlip }));

  // The new page has rendered: play the turn.
  useLayoutEffect(() => {
    const pending = pendingRef.current;
    const el = wrapperRef.current;
    if (!pending || !el) return;
    window.clearTimeout(pending.timer);
    const { dir, overlay, page } = pending;
    pendingRef.current = null;
    el.style.opacity = "";

    const rect = el.getBoundingClientRect();
    const oldHinge = visibleHinge(page.getBoundingClientRect());
    // A soft shadow that deepens as the turning page rises off the stack.
    const lift = "0 30px 60px -20px rgba(0,0,0,0.45)";
    let done: Promise<unknown>;

    if (dir === 1) {
      // Forward: the old page turns over toward the spine, revealing the new one.
      page.style.transformOrigin = `0 ${oldHinge.y}px`;
      done = page.animate(
        [
          {
            transform: `${PERSPECTIVE} rotateY(0deg)`,
            boxShadow: "0 0 0 rgba(0,0,0,0)",
            filter: "brightness(1)",
          },
          { boxShadow: lift, offset: 0.4 },
          {
            transform: `${PERSPECTIVE} rotateY(-92deg)`,
            boxShadow: lift,
            filter: "brightness(0.7)",
          },
        ],
        { duration: FLIP_MS, easing: FLIP_EASE, fill: "forwards" },
      ).finished;
      el.animate([{ filter: "brightness(0.8)" }, { filter: "brightness(1)" }], {
        duration: FLIP_MS,
        easing: "ease-out",
      });
    } else {
      // Back: the previous page turns back over from the spine onto the old one.
      // The snapshot sits in a body-level overlay (above the page), so it
      // fades away as the previous page swings in, rather than z-fighting.
      const hinge = visibleHinge(rect);
      Object.assign(el.style, {
        background: "var(--background)",
        borderRadius: "1rem",
        transformOrigin: `0 ${hinge.y}px`,
      } satisfies Partial<CSSStyleDeclaration>);
      done = el.animate(
        [
          {
            transform: `${PERSPECTIVE} rotateY(-92deg)`,
            boxShadow: lift,
            filter: "brightness(0.7)",
          },
          { boxShadow: lift, offset: 0.6 },
          {
            transform: `${PERSPECTIVE} rotateY(0deg)`,
            boxShadow: "0 0 0 rgba(0,0,0,0)",
            filter: "brightness(1)",
          },
        ],
        { duration: FLIP_MS, easing: FLIP_EASE },
      ).finished;
      page.animate(
        [
          { opacity: 1, filter: "brightness(1)" },
          { opacity: 0, filter: "brightness(0.7)", offset: 0.55 },
          { opacity: 0, filter: "brightness(0.7)" },
        ],
        { duration: FLIP_MS, easing: "ease-in", fill: "forwards" },
      );
    }

    void done
      .catch(() => undefined)
      .then(() => {
        overlay.remove();
        if (!pendingRef.current) resetWrapper();
      });
  }, [activeIndex]);

  // Warm the neighbouring pages so a swipe lands fast.
  useEffect(() => {
    if (activeIndex < 0) return;
    for (const i of [activeIndex - 1, activeIndex + 1]) {
      if (i >= 0 && i < hrefs.length) router.prefetch(hrefs[i]);
    }
  }, [activeIndex, hrefs, router]);

  // Leaving the section mid-turn: drop the snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => clearPending(), []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const boundary: HTMLElement = el;

    let startX: number | null = null;
    let startY = 0;
    let axis: "horizontal" | "vertical" | null = null;
    let blocked = false;
    let dx = 0;

    function follow(offset: number) {
      boundary.style.transition = "none";
      boundary.style.transform = offset ? `translateX(${offset}px)` : "";
    }

    function settle() {
      boundary.style.transition =
        "transform 260ms cubic-bezier(0.32, 0.72, 0, 1)";
      boundary.style.transform = "";
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length > 1 || activeIndexRef.current < 0) {
        startX = null;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = null;
      dx = 0;
      blocked = ownsHorizontalDrag(e.target, boundary);
    }

    function onMove(e: TouchEvent) {
      if (startX === null || blocked) return;
      if (e.touches.length > 1) {
        startX = null;
        settle();
        return;
      }
      dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (axis === null) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (axis !== "horizontal") return;
      e.preventDefault();
      const next = activeIndexRef.current + (dx < 0 ? 1 : -1);
      const atEdge = next < 0 || next >= hrefsRef.current.length;
      if (!prefersReducedMotion())
        follow(dx * (atEdge ? DRAG_FOLLOW / 3 : DRAG_FOLLOW));
    }

    function onEnd() {
      if (startX === null || blocked || axis !== "horizontal") {
        startX = null;
        return;
      }
      startX = null;
      const next = activeIndexRef.current + (dx < 0 ? 1 : -1);
      if (
        Math.abs(dx) >= SWIPE_THRESHOLD_PX &&
        next >= 0 &&
        next < hrefsRef.current.length
      ) {
        beginFlip(dx < 0 ? 1 : -1);
        router.push(hrefsRef.current[next]);
        return;
      }
      settle();
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return <div ref={wrapperRef}>{children}</div>;
}
