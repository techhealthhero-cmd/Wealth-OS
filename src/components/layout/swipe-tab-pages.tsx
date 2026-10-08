"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode, type Ref } from "react";
import { useRouter } from "next/navigation";

import { prefersReducedMotion } from "@/lib/motion/black-hole";
import {
  cornerAlongTurn,
  curlTransforms,
  dragCornerPosition,
  easeOutCubic,
  turnedCornerPosition,
  type Point,
} from "@/lib/motion/page-curl";

// Same commit distance / axis dead-zone the old app-wide tab swipe used.
const SWIPE_THRESHOLD_PX = 60;
const AXIS_LOCK_PX = 10;
// Journal page turn: 450ms at first (2026-10-08 brief), slowed to 650ms on
// the owner's request (2026-10-09) so the turn reads clearly.
const TURN_MS = 650;
const SETTLE_MS = 280;
const BOTTOM_NAV_CLEARANCE_PX = 96;
// A forward turn waits here (paused) if the next page hasn't rendered yet,
// so it never turns over onto a blank page. With the ease-out curve, 8% of
// the time is ~22% of the turn.
const HOLD_AT = 0.08;
// If the new page never arrives (navigation failed), stop waiting for it.
const MAX_WAIT_MS = 5000;

// How many tabs on each side of the active one are prefetched in full.
const PREFETCH_RADIUS = 2;

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Prefetch a route in FULL (its data too, not just up to its loading
 * skeleton) — what `<Link prefetch={true}>` does. Next's public type only
 * names `onInvalidate`, but `router.prefetch` reads `kind: "full"` at
 * runtime (app-router-instance.js → FetchStrategy.Full); the cast bridges
 * the enum type without importing Next internals.
 */
export function prefetchFull(router: AppRouter, href: string, onInvalidate?: () => void) {
  router.prefetch(href, { kind: "full", onInvalidate } as unknown as Parameters<AppRouter["prefetch"]>[1]);
}

/** +1 = next page (forward), -1 = previous page (back). */
export type PageFlipDirection = 1 | -1;

export interface SwipeTabPagesHandle {
  /** Start a page-turn for a navigation that is about to happen (a tab tap). */
  beginFlip: (dir: PageFlipDirection) => void;
}

/**
 * A snapshot of the on-screen part of the page as a sheet of paper that can
 * CURL (2026-10-09, requested: "feel like holding real paper"). A corner is
 * pulled; the paper folds along a slanted line (see src/lib/motion/
 * page-curl.ts) and the lifted part flips over showing the paper's back,
 * with a highlight/shadow along the fold so it reads as a curve, and a
 * shadow cast on the page beneath. Transform-only — no repaint per frame.
 */
interface Curl {
  root: HTMLDivElement;
  frontWrap: HTMLDivElement;
  frontInner: HTMLDivElement;
  flapWrap: HTMLDivElement;
  flapInner: HTMLDivElement;
  cast: HTMLDivElement;
  /** Darkens this sheet when another page lands on top of it. */
  dim: HTMLDivElement;
  w: number;
  h: number;
  /** Longer than the diagonal: the clipping wraps are 2L × L. */
  l: number;
  /** The corner being pulled (its resting place) and where it is now. */
  c: Point;
  p: Point;
  cornerAtBottom: boolean;
}

interface Flight {
  dir: PageFlipDirection;
  /** The sheet that curls: the old page (forward) or the incoming one (back). */
  curl: Curl | null;
  /** Back turns only: the current page, lying flat underneath. */
  under: Curl | null;
  arrived: boolean;
  stop: () => void;
  waitTimer: number;
}

/**
 * Elements that own horizontal drags themselves: native horizontal
 * scrollers (overflow-x auto/scroll only — an `overflow-x: hidden` parent
 * with wide content is not touch-scrollable), swipe-to-delete rows
 * (`data-no-swipe-nav`), sliders, a text field being typed in, and charts
 * (drag = scrub tooltip).
 */
function ownsHorizontalDrag(target: EventTarget | null, boundary: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-no-swipe-nav], input[type='range'], [role='slider'], .recharts-wrapper")) return true;
  // A text field only owns a sideways drag while you're typing in it (it
  // moves the caret / selects text). Dropdowns, file pickers and unfocused
  // fields don't — blocking them made forms like CSV import, which are
  // mostly controls, feel randomly unswipeable (reported 2026-10-08).
  const field = target.closest("input, textarea, [contenteditable='true']");
  if (field && field === document.activeElement) return true;
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

function box(styles: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const div = document.createElement("div");
  Object.assign(div.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none", transformOrigin: "0 0" }, styles);
  return div;
}

/** Snapshots the visible part of `el` into a curlable sheet laid exactly over it. */
function makeCurl(el: HTMLElement, cornerAtBottom: boolean): Curl | null {
  const rect = el.getBoundingClientRect();
  const top = Math.max(rect.top, 0);
  // The sheet runs to the bottom of the screen (not just the end of the
  // content) so a curling flap is never cut off by a straight edge mid-page;
  // below the content it's just more ruled paper, matching the page.
  const bottom = window.innerHeight;
  const w = rect.width;
  const h = bottom - top;
  if (h < 1 || w < 1) return null;
  const l = Math.ceil(Math.hypot(w, h) * 2);

  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  Object.assign(root.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${top}px`,
    width: `${w}px`,
    height: `${h}px`,
    overflow: "hidden",
    zIndex: "20",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);

  // Shadow the lifted paper casts on the page beneath, right along the fold.
  const cast = box({
    width: `${2 * l}px`,
    height: "64px",
    background: "linear-gradient(to bottom, rgba(40,28,10,0.34), rgba(40,28,10,0.12) 30%, rgba(40,28,10,0) 100%)",
    willChange: "transform",
  });

  const frontWrap = box({ width: `${2 * l}px`, height: `${l}px`, overflow: "hidden", willChange: "transform" });
  const frontInner = box({ width: `${w}px`, height: `${h}px`, background: "var(--background)", willChange: "transform" });
  frontInner.classList.add("journal-page");
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  clone.removeAttribute("style");
  Object.assign(clone.style, {
    position: "absolute",
    left: "0",
    top: `${rect.top - top}px`,
    width: `${w}px`,
    margin: "0",
  } satisfies Partial<CSSStyleDeclaration>);
  frontInner.append(clone);
  frontWrap.append(frontInner);

  // The flap: the paper's back (plain ruled paper, a shade warmer), with a
  // curl highlight along the fold — dark crease, a bright band where the
  // curve catches the light, then a soft fall-off.
  const flapWrap = box({ width: `${2 * l}px`, height: `${l}px`, overflow: "hidden", willChange: "transform" });
  const flapInner = box({
    width: `${w}px`,
    height: `${h}px`,
    background: "color-mix(in oklab, var(--card) 82%, var(--journal-edge))",
    willChange: "transform",
  });
  flapInner.classList.add("journal-page");
  const flapShade = box({
    top: "auto",
    bottom: "0",
    width: `${2 * l}px`,
    height: "110px",
    background:
      "linear-gradient(to top, rgba(40,28,10,0.32) 0, rgba(255,250,235,0.55) 9px, rgba(255,250,235,0) 34px, rgba(40,28,10,0.1) 70px, rgba(40,28,10,0) 110px)",
  });
  flapWrap.append(flapInner, flapShade);

  const dim = box({ width: "100%", height: "100%", background: "rgba(20,14,6,1)", opacity: "0" });

  root.append(cast, frontWrap, flapWrap, dim);
  document.body.appendChild(root);
  // The bottom corner sits just above the bottom nav (which covers the
  // screen's last ~96px), so the grabbed corner is never hidden behind it.
  const c = { x: w, y: cornerAtBottom ? Math.max(h - BOTTOM_NAV_CLEARANCE_PX, h * 0.6) : 0 };
  const curl: Curl = { root, frontWrap, frontInner, flapWrap, flapInner, cast, dim, w, h, l, c, p: c, cornerAtBottom };
  applyCurl(curl, c);
  return curl;
}

/** Pose the sheet with its corner at `p`. */
function applyCurl(curl: Curl, p: Point) {
  curl.p = p;
  const t = curlTransforms(curl.c, p, curl.l, curl.w);
  curl.frontWrap.style.transform = t.frontWrap;
  curl.frontInner.style.transform = t.frontInner;
  curl.flapWrap.style.transform = t.flapWrap;
  curl.flapInner.style.transform = t.flapInner;
  curl.cast.style.transform = t.cast;
  // The cast shadow fades in as the corner lifts and out as the page leaves.
  curl.cast.style.opacity = String(Math.min(t.amount * 4, 1) * Math.max(0, 1 - Math.max(0, t.amount - 1.6) * 2));
}

/**
 * Moves the corner from `from` to `to` over `duration` on an arc, frame by
 * frame. `holdWhile` freezes progress at `holdAt` (the next page isn't
 * ready yet) without skipping ahead once it resumes. Returns a stop
 * function.
 */
function runCurl(
  curl: Curl,
  from: Point,
  to: Point,
  duration: number,
  opts: { holdAt?: number; holdWhile?: () => boolean; onFrame?: (eased: number) => void; onDone: () => void }
): () => void {
  let elapsed = 0;
  let last = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    elapsed += now - last;
    last = now;
    if (opts.holdAt !== undefined && opts.holdWhile?.()) elapsed = Math.min(elapsed, duration * opts.holdAt);
    const t = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(t);
    applyCurl(curl, cornerAlongTurn(from, to, eased, curl.h, curl.cornerAtBottom));
    opts.onFrame?.(eased);
    if (t >= 1) {
      opts.onDone();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/**
 * Wraps a section's page content (Money / Plan / Earn) so a horizontal
 * swipe moves to the next/previous tab — requested 2026-10-08 — with a
 * paper page-turn. Forward: grab the page and its corner curls up under
 * your finger, folding along a slanted line, then turns over past the
 * spine, revealing the next page. Back: the previous page curls back in
 * from the spine and lands on top. Tapping a tab (SegmentedTabs calls
 * `beginFlip`) plays the same turn.
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
  // The sheet being curled by the finger before the swipe commits.
  const dragCurlRef = useRef<Curl | null>(null);
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
    flight.stop();
    window.clearTimeout(flight.waitTimer);
    flight.curl?.root.remove();
    flight.under?.root.remove();
    flightRef.current = null;
    showLive();
  }

  function dropDragCurl() {
    dragCurlRef.current?.root.remove();
    dragCurlRef.current = null;
  }

  /** Forward: curl the old page the rest of the way over; holds at HOLD_AT until the next page has rendered. */
  function turnForward(curl: Curl) {
    const to = turnedCornerPosition(curl.c, curl.w, curl.h);
    const from = curl.p;
    const remaining = Math.min(Math.max((from.x - to.x) / (curl.c.x - to.x), 0.4), 1);
    const flight: Flight = {
      dir: 1,
      curl,
      under: null,
      arrived: false,
      stop: () => undefined,
      waitTimer: window.setTimeout(endFlight, MAX_WAIT_MS),
    };
    flightRef.current = flight;
    flight.stop = runCurl(curl, from, to, TURN_MS * remaining, {
      holdAt: HOLD_AT,
      holdWhile: () => !flight.arrived,
      onDone: () => {
        if (flightRef.current === flight) endFlight();
      },
    });
  }

  /** Back: keep the current page as a flat sheet until the previous page renders, which then curls in on top. */
  function holdForBack(under: Curl) {
    flightRef.current = {
      dir: -1,
      curl: null,
      under,
      arrived: false,
      stop: () => undefined,
      waitTimer: window.setTimeout(endFlight, MAX_WAIT_MS),
    };
  }

  function start(dir: PageFlipDirection, curlFromDrag: Curl | null) {
    endFlight();
    const el = wrapperRef.current;
    if (!el || prefersReducedMotion()) {
      dropDragCurl();
      return;
    }
    el.style.transition = "";
    el.style.transform = "";
    const curl = curlFromDrag ?? makeCurl(el, true);
    dragCurlRef.current = null;
    if (!curl) return;
    // The sheet stands in for the live page until the new one renders.
    el.style.opacity = "0";
    if (dir === 1) turnForward(curl);
    else holdForBack(curl);
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
      // The next page is ready underneath — the turn carries on by itself
      // (runCurl's hold releases once `arrived` is true).
      el.style.opacity = "";
      return;
    }

    // Back: snapshot the previous page and curl it in from the spine.
    el.style.opacity = "";
    const incoming = makeCurl(el, true);
    if (!incoming) {
      endFlight();
      return;
    }
    el.style.opacity = "0";
    const from = turnedCornerPosition(incoming.c, incoming.w, incoming.h);
    applyCurl(incoming, from);
    flight.curl = incoming;
    const under = flight.under;
    flight.stop = runCurl(incoming, from, incoming.c, TURN_MS, {
      // The current page falls into the incoming page's shadow as it's covered.
      onFrame: (eased) => {
        if (under) under.dim.style.opacity = String(0.28 * eased);
      },
      onDone: () => {
        if (flightRef.current === flight) endFlight();
      },
    });
    // Runs only when the page actually changes; everything else is read via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // Fully prefetch (data included) the two tabs on each side, so even fast
  // consecutive swipes land on ready pages — regardless of whether those
  // tabs are scrolled into view on the tab strip. When a save invalidates
  // a prefetched page, fetch it again while this is still the active tab.
  useEffect(() => {
    if (activeIndex < 0) return;
    let live = true;
    function warm(href: string) {
      prefetchFull(router, href, () => {
        if (live) warm(href);
      });
    }
    for (let d = -PREFETCH_RADIUS; d <= PREFETCH_RADIUS; d++) {
      const i = activeIndex + d;
      if (d !== 0 && i >= 0 && i < hrefs.length) warm(hrefs[i]);
    }
    return () => {
      live = false;
    };
  }, [activeIndex, hrefs, router]);

  // Leaving the section mid-turn: drop any sheets.
  useEffect(
    () => () => {
      endFlight();
      dropDragCurl();
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
    let dy = 0;
    let stopSettle: (() => void) | null = null;

    function targetIndex(delta: number) {
      return activeIndexRef.current + (delta < 0 ? 1 : -1);
    }
    function canGo(delta: number) {
      const next = targetIndex(delta);
      return next >= 0 && next < hrefsRef.current.length;
    }

    /** Live feedback: forward curls the page's corner under the finger; back (or a dead end) just leans the page. */
    function follow() {
      if (prefersReducedMotion() || flightRef.current) return;
      if (dx < 0 && canGo(dx)) {
        boundary.style.transform = "";
        if (!dragCurlRef.current) {
          // Grab the corner nearest the finger: the bottom corner when the
          // touch is in the lower part of the visible page, else the top.
          const rect = boundary.getBoundingClientRect();
          const visibleTop = Math.max(rect.top, 0);
          const visibleBottom = Math.min(rect.bottom, window.innerHeight);
          const curl = makeCurl(boundary, startY > (visibleTop + visibleBottom) / 2);
          if (!curl) return;
          dragCurlRef.current = curl;
          boundary.style.opacity = "0";
        }
        const curl = dragCurlRef.current;
        applyCurl(curl, dragCornerPosition(curl.c, dx, dy, curl.w, curl.h));
        return;
      }
      if (dragCurlRef.current) {
        dropDragCurl();
        boundary.style.opacity = "";
      }
      const lean = canGo(dx) ? 0.16 : 0.06;
      boundary.style.transition = "none";
      boundary.style.transform = `translateX(${dx * lean}px)`;
    }

    /** Swipe released short of committing: the corner falls back flat. */
    function settle() {
      const curl = dragCurlRef.current;
      dragCurlRef.current = null;
      if (curl) {
        stopSettle = runCurl(curl, curl.p, curl.c, SETTLE_MS, {
          onDone: () => {
            stopSettle = null;
            curl.root.remove();
            if (!flightRef.current) boundary.style.opacity = "";
          },
        });
        return;
      }
      boundary.style.transition = `transform ${SETTLE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;
      boundary.style.transform = "";
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length > 1 || activeIndexRef.current < 0) {
        startX = null;
        return;
      }
      // A new swipe while a page is still turning: land the turn now so
      // fast consecutive swipes are never dropped.
      if (flightRef.current?.arrived) endFlight();
      else if (flightRef.current) {
        startX = null;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = null;
      dx = 0;
      dy = 0;
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
      dy = e.touches[0].clientY - startY;
      if (axis === null) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (axis !== "horizontal") return;
      e.preventDefault();
      follow();
    }

    function onEnd() {
      if (startX === null || blocked || axis !== "horizontal") {
        startX = null;
        return;
      }
      startX = null;
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && canGo(dx)) {
        const href = hrefsRef.current[targetIndex(dx)];
        start(dx < 0 ? 1 : -1, dragCurlRef.current);
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
      stopSettle?.();
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Reported (หนี้สิน): on a short page the only content was a card with its
  // own swipe-to-delete gesture, and the empty space below it wasn't part of
  // this element at all — so there was nowhere left to swipe. The minimum
  // height stretches the swipe area down to roughly the bottom nav (header +
  // title + tab strip ≈ 16rem above, the layout's pb-28 ≈ 7rem below, plus
  // ~2rem slack) without making a short page scroll.
  return (
    <div ref={wrapperRef} className="min-h-[calc(100dvh-25rem)]">
      {children}
    </div>
  );
}
