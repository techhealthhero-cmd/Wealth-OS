"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode, type Ref } from "react";
import { useRouter } from "next/navigation";

import { prefersReducedMotion } from "@/lib/motion/black-hole";

// Same commit distance / axis dead-zone the old app-wide tab swipe used.
const SWIPE_THRESHOLD_PX = 60;
const AXIS_LOCK_PX = 10;
// While dragging forward, the page peels up to this angle with the finger.
const MAX_PEEL_DEG = 38;
// Past edge-on, so the turning page is fully gone (backface hidden).
const TURNED_DEG = -100;
const TURN_MS = 640;
const TURN_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const LAND_EASE = "cubic-bezier(0.3, 0, 0.2, 1)";
const SETTLE_MS = 280;
const SETTLE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
// A forward turn waits here (paused) if the next page hasn't rendered yet,
// so it never turns over onto a blank page.
const HOLD_AT = 0.3;
// If the new page never arrives (navigation failed), stop waiting for it.
const MAX_WAIT_MS = 5000;

/** +1 = next page (forward), -1 = previous page (back). */
export type PageFlipDirection = 1 | -1;

export interface SwipeTabPagesHandle {
  /** Start a page-turn for a navigation that is about to happen (a tab tap). */
  beginFlip: (dir: PageFlipDirection) => void;
}

/**
 * A snapshot of the on-screen part of the page, as a sheet of paper that can
 * turn: only `transform`/`opacity` animate, on a viewport-sized layer, so
 * the turn stays on the compositor (the first version animated filter and
 * box-shadow on a clone of the whole, possibly very long, page — janky).
 */
interface Sheet {
  root: HTMLDivElement;
  /** The paper itself — rotates about its left edge (the spine). */
  page: HTMLDivElement;
  /** Darkens the paper as it turns away from the light. */
  shade: HTMLDivElement;
  /** Spine shadow cast on whatever lies underneath the paper. */
  under: HTMLDivElement;
}

interface Flight {
  dir: PageFlipDirection;
  sheet: Sheet;
  /** Back turns only: the previous page's sheet, turning in on top. */
  incoming?: Sheet;
  anims: Animation[];
  arrived: boolean;
  holdTimer: number;
  waitTimer: number;
}

/**
 * Elements that own horizontal drags themselves: native horizontal
 * scrollers (overflow-x auto/scroll only — an `overflow-x: hidden` parent
 * with wide content is not touch-scrollable), swipe-to-delete rows
 * (`data-no-swipe-nav`), form controls, and charts (drag = scrub tooltip).
 */
function ownsHorizontalDrag(target: EventTarget | null, boundary: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-no-swipe-nav], input, textarea, select, [role='slider'], .recharts-wrapper")) return true;
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

function layer(styles: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const div = document.createElement("div");
  Object.assign(div.style, { position: "absolute", inset: "0", pointerEvents: "none" }, styles);
  return div;
}

/** Snapshots the visible part of `el` into a fixed sheet laid exactly over it. */
function makeSheet(el: HTMLElement): Sheet | null {
  const rect = el.getBoundingClientRect();
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  if (bottom - top < 1 || rect.width < 1) return null;

  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  Object.assign(root.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${top}px`,
    width: `${rect.width}px`,
    height: `${bottom - top}px`,
    zIndex: "20",
    pointerEvents: "none",
    perspective: "1800px",
    perspectiveOrigin: "0 50%",
  } satisfies Partial<CSSStyleDeclaration>);

  const under = layer({
    background: "linear-gradient(to right, rgba(0,0,0,0.32), rgba(0,0,0,0.08) 35%, rgba(0,0,0,0) 70%)",
    opacity: "0",
  });
  const page = layer({
    overflow: "hidden",
    background: "var(--background)",
    transformOrigin: "0 50%",
    backfaceVisibility: "hidden",
    willChange: "transform",
  });
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  clone.removeAttribute("style");
  Object.assign(clone.style, {
    position: "absolute",
    left: "0",
    top: `${rect.top - top}px`,
    width: `${rect.width}px`,
    margin: "0",
  } satisfies Partial<CSSStyleDeclaration>);
  const shade = layer({
    background: "linear-gradient(to left, rgba(0,0,0,0.38), rgba(0,0,0,0.12))",
    opacity: "0",
  });
  page.append(clone, shade);
  root.append(under, page);
  document.body.appendChild(root);
  return { root, page, shade, under };
}

/** Pose of a forward-turning sheet at `deg` (0 = flat, TURNED_DEG = gone). */
function setPeel(sheet: Sheet, deg: number) {
  const t = Math.min(Math.abs(deg) / 90, 1);
  sheet.page.style.transform = `rotateY(${deg}deg)`;
  sheet.shade.style.opacity = String(t);
  sheet.under.style.opacity = String(Math.min(t * 3, 1));
}

/**
 * Wraps a section's page content (Money / Plan / Earn) so a horizontal
 * swipe moves to the next/previous tab — requested 2026-10-08 — with a
 * book page-turn. Forward: the current page peels up from its right edge
 * as you drag and turns over toward the spine (left edge), revealing the
 * next page with a spine shadow. Back: the previous page turns back over
 * from the spine and lands on top of the current one. Tapping a tab
 * (SegmentedTabs calls `beginFlip`) plays the same turn.
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
  const flightRef = useRef<Flight | null>(null);
  // The sheet being peeled by the finger before the swipe commits.
  const dragSheetRef = useRef<Sheet | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const hrefsRef = useRef(hrefs);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
    hrefsRef.current = hrefs;
  });

  function showLive() {
    const el = wrapperRef.current;
    if (!el) return;
    el.style.opacity = "";
    el.style.transform = "";
    el.style.transition = "";
  }

  function endFlight() {
    const flight = flightRef.current;
    if (!flight) return;
    window.clearTimeout(flight.holdTimer);
    window.clearTimeout(flight.waitTimer);
    flight.anims.forEach((a) => a.cancel());
    flight.sheet.root.remove();
    flight.incoming?.root.remove();
    flightRef.current = null;
    showLive();
  }

  function dropDragSheet() {
    dragSheetRef.current?.root.remove();
    dragSheetRef.current = null;
  }

  /** Forward: turn `sheet` over from its current pose; holds at HOLD_AT until the next page has rendered. */
  function turnForward(sheet: Sheet) {
    const fromDeg = parseFloat(sheet.page.style.transform.replace(/[^-\d.]/g, "")) || 0;
    const fromT = Math.min(Math.abs(fromDeg) / 90, 1);
    const remaining = 1 - Math.abs(fromDeg) / Math.abs(TURNED_DEG);
    const duration = Math.max(TURN_MS * remaining, 260);
    const opts: KeyframeAnimationOptions = { duration, easing: TURN_EASE, fill: "forwards" };
    const anims = [
      sheet.page.animate([{ transform: `rotateY(${fromDeg}deg)` }, { transform: `rotateY(${TURNED_DEG}deg)` }], opts),
      sheet.shade.animate([{ opacity: fromT }, { opacity: 1 }], opts),
      sheet.under.animate(
        [{ opacity: Math.min(fromT * 3, 1) }, { opacity: 1, offset: 0.35 }, { opacity: 0 }],
        opts
      ),
    ];
    const flight: Flight = {
      dir: 1,
      sheet,
      anims,
      arrived: false,
      holdTimer: window.setTimeout(() => {
        if (flightRef.current === flight && !flight.arrived) anims.forEach((a) => a.pause());
      }, duration * HOLD_AT),
      waitTimer: window.setTimeout(endFlight, MAX_WAIT_MS),
    };
    flightRef.current = flight;
    void anims[0].finished.then(
      () => {
        if (flightRef.current === flight) endFlight();
      },
      () => undefined
    );
  }

  /** Back: keep the current page as a sheet until the previous page renders, which then turns in on top. */
  function holdForBack(sheet: Sheet) {
    const flight: Flight = {
      dir: -1,
      sheet,
      anims: [],
      arrived: false,
      holdTimer: 0,
      waitTimer: window.setTimeout(endFlight, MAX_WAIT_MS),
    };
    flightRef.current = flight;
  }

  function start(dir: PageFlipDirection, sheetFromDrag: Sheet | null) {
    endFlight();
    const el = wrapperRef.current;
    if (!el || prefersReducedMotion()) {
      dropDragSheet();
      return;
    }
    el.style.transition = "";
    el.style.transform = "";
    const sheet = sheetFromDrag ?? makeSheet(el);
    dragSheetRef.current = null;
    if (!sheet) return;
    // The sheet stands in for the live page until the new one renders.
    el.style.opacity = "0";
    if (dir === 1) turnForward(sheet);
    else holdForBack(sheet);
  }

  useImperativeHandle(handleRef, () => ({ beginFlip: (dir) => start(dir, null) }));

  // The new page has rendered.
  useLayoutEffect(() => {
    const flight = flightRef.current;
    const el = wrapperRef.current;
    if (!flight || !el || flight.arrived) return;
    flight.arrived = true;
    window.clearTimeout(flight.waitTimer);

    if (flight.dir === 1) {
      // The next page is ready underneath — let the turn carry on.
      el.style.opacity = "";
      flight.anims.forEach((a) => {
        if (a.playState === "paused") a.play();
      });
      return;
    }

    // Back: snapshot the previous page and turn it in over the current one.
    el.style.opacity = "";
    const incoming = makeSheet(el);
    if (!incoming) {
      endFlight();
      return;
    }
    el.style.opacity = "0";
    const old = flight.sheet;
    const opts: KeyframeAnimationOptions = { duration: TURN_MS, easing: LAND_EASE, fill: "forwards" };
    incoming.page.style.transform = `rotateY(${TURNED_DEG}deg)`;
    const anims = [
      incoming.page.animate([{ transform: `rotateY(${TURNED_DEG}deg)` }, { transform: "rotateY(0deg)" }], opts),
      incoming.shade.animate([{ opacity: 1 }, { opacity: 0 }], opts),
      // The current page falls into the incoming page's shadow as it's covered.
      old.shade.animate([{ opacity: 0 }, { opacity: 0.7 }], opts),
    ];
    flight.anims = anims;
    flight.incoming = incoming;
    void anims[0].finished.then(
      () => {
        if (flightRef.current === flight) endFlight();
      },
      () => undefined
    );
    // Runs only when the page actually changes; everything else is read via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // (The neighbouring tabs are fully prefetched by SegmentedTabs' links.)

  // Leaving the section mid-turn: drop any sheets.
  useEffect(
    () => () => {
      endFlight();
      dropDragSheet();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const boundary: HTMLElement = el;

    let startX: number | null = null;
    let startY = 0;
    let axis: "horizontal" | "vertical" | null = null;
    let blocked = false;
    let dx = 0;

    function targetIndex(delta: number) {
      return activeIndexRef.current + (delta < 0 ? 1 : -1);
    }
    function canGo(delta: number) {
      const next = targetIndex(delta);
      return next >= 0 && next < hrefsRef.current.length;
    }

    /** Live feedback: forward peels the page; back (or a dead end) just leans the page. */
    function follow(delta: number) {
      if (prefersReducedMotion() || flightRef.current) return;
      if (delta < 0 && canGo(delta)) {
        boundary.style.transform = "";
        if (!dragSheetRef.current) {
          const sheet = makeSheet(boundary);
          if (!sheet) return;
          dragSheetRef.current = sheet;
          boundary.style.opacity = "0";
        }
        const progress = Math.min(-delta / (boundary.clientWidth * 0.6), 1);
        setPeel(dragSheetRef.current, -MAX_PEEL_DEG * progress);
        return;
      }
      if (dragSheetRef.current) {
        dropDragSheet();
        boundary.style.opacity = "";
      }
      const lean = canGo(delta) ? 0.16 : 0.06;
      boundary.style.transition = "none";
      boundary.style.transform = `translateX(${delta * lean}px)`;
    }

    /** Swipe released short of committing: lay everything back down. */
    function settle() {
      const sheet = dragSheetRef.current;
      dragSheetRef.current = null;
      if (sheet) {
        const opts: KeyframeAnimationOptions = { duration: SETTLE_MS, easing: SETTLE_EASE, fill: "forwards" };
        sheet.page.animate([{ transform: sheet.page.style.transform }, { transform: "rotateY(0deg)" }], opts);
        sheet.shade.animate([{ opacity: sheet.shade.style.opacity }, { opacity: 0 }], opts);
        void sheet.under
          .animate([{ opacity: sheet.under.style.opacity }, { opacity: 0 }], opts)
          .finished.catch(() => undefined)
          .then(() => {
            sheet.root.remove();
            if (!flightRef.current) boundary.style.opacity = "";
          });
        return;
      }
      boundary.style.transition = `transform ${SETTLE_MS}ms ${SETTLE_EASE}`;
      boundary.style.transform = "";
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length > 1 || activeIndexRef.current < 0 || flightRef.current) {
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
      follow(dx);
    }

    function onEnd() {
      if (startX === null || blocked || axis !== "horizontal") {
        startX = null;
        return;
      }
      startX = null;
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && canGo(dx)) {
        const href = hrefsRef.current[targetIndex(dx)];
        start(dx < 0 ? 1 : -1, dragSheetRef.current);
        router.push(href);
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
