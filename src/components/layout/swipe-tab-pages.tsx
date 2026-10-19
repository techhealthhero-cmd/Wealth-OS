"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode, type Ref } from "react";
import { useRouter } from "next/navigation";

import { finishPageAnimations, waitForNoSkeleton } from "@/lib/motion/page-arrival";
import { listenToTouchGesture } from "@/lib/motion/touch-gesture";
import { prefersReducedMotion } from "@/lib/motion/black-hole";
import {
  backDragCornerPosition,
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
// 2026-10-19: arrival fires when the route's loading.tsx skeleton renders; give the
// real content this long to replace it before the turn lands, so it never
// pops in right after the paper is gone.
const CONTENT_WAIT_MS = 900;

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
  /** False for a sheet whose face is blank paper (a page we have no snapshot of). */
  face: boolean;
  /**
   * Forward drags: what lies beneath the curling page until the next page
   * renders — that page's snapshot, or plain paper (never the half-hidden
   * live content showing through the fold).
   */
  underLayer: HTMLDivElement | null;
}

interface Flight {
  dir: PageFlipDirection;
  /** The sheet that curls: the old page (forward) or the incoming one (back). */
  curl: Curl | null;
  /** Back turns only: the current page, lying flat underneath. */
  under: Curl | null;
  /**
   * Back turns started by a drag: the previous page's plain back, lifted in
   * from the spine under the finger. It stays on top until that page has
   * rendered, then the real sheet takes over from the same pose.
   */
  preview: Curl | null;
  arrived: boolean;
  contentDeadline?: number;
  cancelContentWait?: () => void;
  live?: HTMLElement;
  stop: () => void;
  waitTimer: number;
  /**
   * The turn leads into ANOTHER section (Money's last tab → Plan's first):
   * this wrapper unmounts mid-turn, and the next section's wrapper picks the
   * flight up when it mounts — so it must not be cancelled on unmount.
   */
  crossing: boolean;
}

/**
 * The page-turn in progress, shared by every SwipeTabPages on screen. Module
 * level (not per instance) so a turn that crosses into another section —
 * whose layout mounts a NEW wrapper — is finished by that new wrapper.
 */
const flightRef: { current: Flight | null } = { current: null };

/**
 * A copy of each page as it was when last turned away from (2026-10-15), so
 * dragging back can show the previous page's real face lifting in instead
 * of blank paper. Pinned at the page's top (navigation lands scrolled to the
 * top); replaced by the live page the moment it renders. Small and in
 * memory only — a handful of DOM copies, never persisted.
 */
const pageSnapshots = new Map<string, HTMLElement>();
const MAX_SNAPSHOTS = 10;

function pathOf(href: string): string {
  return new URL(href, window.location.origin).pathname;
}

function rememberPage(el: HTMLElement) {
  const main = el.closest("main");
  if (!main) return;
  const r = main.getBoundingClientRect();
  const key = window.location.pathname;
  pageSnapshots.delete(key);
  pageSnapshots.set(key, placedClone(main, r.left, r.top));
  if (pageSnapshots.size > MAX_SNAPSHOTS) pageSnapshots.delete(pageSnapshots.keys().next().value!);
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

/** A copy of `node` pinned at its on-screen place inside a sheet whose top-left is (`left`, `top`). */
function placedClone(node: HTMLElement, left: number, top: number): HTMLElement {
  const r = node.getBoundingClientRect();
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  clone.removeAttribute("id");
  // The live page may be mid-lean (a drag's translateX) or hidden; the copy is neither.
  clone.querySelectorAll<HTMLElement>("[data-turn-page]").forEach((n) => n.removeAttribute("style"));
  if (clone.hasAttribute("data-turn-page")) clone.removeAttribute("style");
  Object.assign(clone.style, {
    position: "absolute",
    left: `${r.left - left}px`,
    top: `${r.top - top}px`,
    width: `${r.width}px`,
    margin: "0",
  } satisfies Partial<CSSStyleDeclaration>);
  return clone;
}

/**
 * Snapshots content into a curlable sheet starting at the swipe wrapper.
 * 2026-10-19: supersedes the 2026-10-14 whole-main turn decision. Section
 * titles and tab strips stay live above the sheet; only content turns.
 * Home has no strip and keeps its existing content edge. The main clone
 * retains its screen position inside the clipped sheet.
 */
function makeCurl(
  el: HTMLElement,
  cornerAtBottom: boolean,
  face?: HTMLElement | "blank",
  beneath?: HTMLElement | "blank"
): Curl | null {
  const main = el.closest("main");
  const rect = (main ?? el).getBoundingClientRect();
  const wrapperRect = el.getBoundingClientRect();
  const top = Math.max(wrapperRect.top, rect.top, 0);
  // Saved snapshots are relative to main; paper rules share that origin.
  const mainOffsetY = rect.top - top;
  function snapshotClone(snapshot: HTMLElement): HTMLElement {
    const clone = snapshot.cloneNode(true) as HTMLElement;
    clone.style.top = `${mainOffsetY}px`;
    return clone;
  }
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
  const frontInner = box({ width: `${w}px`, height: `${h}px`, background: "var(--background)", overflow: "hidden", contain: "paint", willChange: "transform" });
  // "page-curl-sheet" freezes the copy: cards that fade in on mount would
  // otherwise replay that fade from transparent in the snapshot.
  frontInner.classList.add("journal-page", "page-curl-sheet");
  frontInner.style.backgroundPositionY = `${mainOffsetY}px`;
  // `face`: by default this page as it is now; a saved snapshot of another
  // page (the previous one, while dragging back); or "blank" when we have
  // none — then only its back ever shows, so its face needs no content.
  if (face === undefined) frontInner.append(placedClone(main ?? el, rect.left, top));
  else if (face !== "blank") frontInner.append(snapshotClone(face));
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
  flapInner.style.backgroundPositionY = `${mainOffsetY}px`;
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

  let underLayer: HTMLDivElement | null = null;
  if (beneath !== undefined) {
    underLayer = box({ width: `${w}px`, height: `${h}px`, background: "var(--background)", overflow: "hidden", contain: "paint" });
    underLayer.classList.add("journal-page", "page-curl-sheet");
    underLayer.style.backgroundPositionY = `${mainOffsetY}px`;
    if (beneath !== "blank") underLayer.append(snapshotClone(beneath));
    root.append(underLayer);
  }
  root.append(cast, frontWrap, flapWrap, dim);
  document.body.appendChild(root);
  // The bottom corner sits just above the bottom nav (which covers the
  // screen's last ~96px), so the grabbed corner is never hidden behind it.
  const c = { x: w, y: cornerAtBottom ? Math.max(h - BOTTOM_NAV_CLEARANCE_PX, h * 0.6) : 0 };
  const curl: Curl = {
    root,
    frontWrap,
    frontInner,
    flapWrap,
    flapInner,
    cast,
    dim,
    w,
    h,
    l,
    c,
    p: c,
    cornerAtBottom,
    face: face !== "blank",
    underLayer,
  };
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
  prevHref = null,
  nextHref = null,
  onCloseBook,
}: {
  hrefs: string[];
  activeIndex: number;
  children: ReactNode;
  handleRef?: Ref<SwipeTabPagesHandle>;
  /** The book page before this section's first tab (the previous section's last page). */
  prevHref?: string | null;
  /** The book page after this section's last tab (the next section's first page). */
  nextHref?: string | null;
  /** First page of the book (Home): swiping back closes the cover instead. */
  onCloseBook?: () => void;
}) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  // The sheet being curled by the finger before the swipe commits.
  const dragCurlRef = useRef<Curl | null>(null);
  // Dragging back: the previous page's back lifting in from the spine.
  const backPreviewRef = useRef<Curl | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const hrefsRef = useRef(hrefs);
  const edgesRef = useRef({ prevHref, nextHref, onCloseBook });
  useEffect(() => {
    activeIndexRef.current = activeIndex;
    hrefsRef.current = hrefs;
    edgesRef.current = { prevHref, nextHref, onCloseBook };
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
    flight.cancelContentWait?.();
    window.clearTimeout(flight.waitTimer);
    delete document.documentElement.dataset.pageTurning;
    if (flight.arrived && flight.live?.isConnected) finishPageAnimations(flight.live);
    flight.curl?.root.remove();
    flight.under?.root.remove();
    flight.preview?.root.remove();
    if (flight.live) flight.live.style.opacity = "";
    flightRef.current = null;
    showLive();
  }

  function dropDragCurl() {
    dragCurlRef.current?.root.remove();
    dragCurlRef.current = null;
    backPreviewRef.current?.root.remove();
    backPreviewRef.current = null;
  }

  /** Forward: curl the old page the rest of the way over; holds at HOLD_AT until the next page has rendered. */
  function turnForward(curl: Curl, crossing: boolean) {
    const to = turnedCornerPosition(curl.c, curl.w, curl.h);
    const from = curl.p;
    const remaining = Math.min(Math.max((from.x - to.x) / (curl.c.x - to.x), 0.4), 1);
    const flight: Flight = {
      dir: 1,
      curl,
      under: null,
      preview: null,
      arrived: false,
      stop: () => undefined,
      waitTimer: window.setTimeout(endFlight, MAX_WAIT_MS),
      crossing,
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
  function holdForBack(under: Curl, preview: Curl | null, crossing: boolean) {
    // The lifted back must stay above the flat copy of the current page.
    if (preview) preview.root.style.zIndex = "21";
    flightRef.current = {
      dir: -1,
      curl: null,
      under,
      preview,
      arrived: false,
      stop: () => undefined,
      waitTimer: window.setTimeout(endFlight, MAX_WAIT_MS),
      crossing,
    };
  }

  function start(dir: PageFlipDirection, curlFromDrag: Curl | null, crossing = false) {
    endFlight();
    const el = wrapperRef.current;
    if (el) rememberPage(el);
    if (!el || prefersReducedMotion()) {
      dropDragCurl();
      return;
    }
    el.style.transition = "";
    el.style.transform = "";
    const preview = dir === -1 ? backPreviewRef.current : null;
    backPreviewRef.current = null;
    const curl = curlFromDrag ?? makeCurl(el, true);
    dragCurlRef.current = null;
    if (!curl) {
      preview?.root.remove();
      return;
    }
    document.documentElement.dataset.pageTurning = "";
    // The sheet stands in for the live page until the new one renders.
    el.style.opacity = "0";
    if (dir === 1) turnForward(curl, crossing);
    else holdForBack(curl, preview, crossing);
  }

  useImperativeHandle(handleRef, () => ({ beginFlip: (dir) => start(dir, null) }));

  // Route arrival can be a loading fallback; keep the paper until content is ready.
  useLayoutEffect(() => {
    const flight = flightRef.current;
    const el = wrapperRef.current;
    if (!flight || !el || flight.arrived) return;
    flight.cancelContentWait?.();
    flight.live = el;
    document.documentElement.dataset.pageTurning = "";
    el.style.opacity = "0";
    flight.contentDeadline ??= performance.now() + CONTENT_WAIT_MS;
    const land = () => {
      if (flightRef.current !== flight || !el.isConnected) return;
      flight.arrived = true;
      // Landed: the page is here, so the "never arrived" guard must not cut
      // the rest of the turn short.
      window.clearTimeout(flight.waitTimer);

      if (flight.dir === 1) {
        // The next page is ready underneath — the turn carries on by itself
        // (runCurl's hold releases once `arrived` is true). The live page now
        // takes over from the snapshot that stood in for it.
        el.style.opacity = "";
        flight.curl?.underLayer?.remove();
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
      const turned = turnedCornerPosition(incoming.c, incoming.w, incoming.h);
      // A drag already lifted this page partway in: carry on from that pose
      // (the plain back it showed is now this real sheet's back), for the
      // rest of the turn's time — no jump back to the spine.
      const from = flight.preview ? flight.preview.p : turned;
      const remaining = Math.min(Math.max((incoming.c.x - from.x) / (incoming.c.x - turned.x), 0.4), 1);
      if (flight.preview) incoming.root.style.zIndex = "21";
      applyCurl(incoming, from);
      flight.preview?.root.remove();
      flight.preview = null;
      flight.curl = incoming;
      const under = flight.under;
      flight.stop = runCurl(incoming, from, incoming.c, TURN_MS * remaining, {
        // The current page falls into the incoming page's shadow as it's covered.
        onFrame: (eased) => {
          if (under) under.dim.style.opacity = String(0.28 * eased);
        },
        onDone: () => {
          if (flightRef.current === flight) endFlight();
        },
      });
    };
    flight.cancelContentWait = waitForNoSkeleton(
      el, land, Math.max(0, flight.contentDeadline - performance.now())
    );
    return () => {
      if (flight.live === el) {
        flight.cancelContentWait?.();
        flight.cancelContentWait = undefined;
        flight.live = undefined;
        delete document.documentElement.dataset.pageTurning;
      }
    };
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
    // The neighbouring sections' facing pages, so a turn across sections lands ready too.
    if (prevHref) warm(prevHref);
    if (nextHref) warm(nextHref);
    return () => {
      live = false;
    };
  }, [activeIndex, hrefs, prevHref, nextHref, router]);

  // Leaving the section mid-turn: drop any sheets — unless the turn itself
  // is what's taking us to the next section (that section finishes it).
  useEffect(
    () => () => {
      if (!flightRef.current?.crossing) endFlight();
      if (!flightRef.current) delete document.documentElement.dataset.pageTurning;
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
    let disposeGesture: (() => void) | null = null;

    /** The page a swipe leads to: the next/previous tab, else the neighbouring section's facing page. */
    function targetHref(delta: number): string | null {
      const dir = delta < 0 ? 1 : -1;
      const inSection = hrefsRef.current[activeIndexRef.current + dir];
      if (inSection) return inSection;
      return dir === 1 ? edgesRef.current.nextHref : edgesRef.current.prevHref;
    }
    /** Swiping back on the book's first page closes the cover. */
    function closesBook(delta: number) {
      return delta > 0 && activeIndexRef.current === 0 && !targetHref(delta) && Boolean(edgesRef.current.onCloseBook);
    }
    function canGo(delta: number) {
      return targetHref(delta) !== null || closesBook(delta);
    }

    /**
     * Live feedback, all on paper sheets laid over the page — the live page
     * itself never slides. The title + tab strip stay above the content
     * sheet throughout preview and flight. Forward curls this page's corner
     * under the finger; back lifts
     * the previous page's back in from the spine; a dead end does nothing.
     */
    function follow() {
      if (prefersReducedMotion() || flightRef.current) return;
      if (dx > 0 && canGo(dx)) {
        if (dragCurlRef.current) {
          dragCurlRef.current.root.remove();
          dragCurlRef.current = null;
          boundary.style.opacity = "";
        }
        if (!backPreviewRef.current) {
          const target = targetHref(dx);
          const snapshot = target ? pageSnapshots.get(pathOf(target)) : undefined;
          const curl = makeCurl(boundary, true, snapshot ?? "blank");
          if (!curl) return;
          backPreviewRef.current = curl;
        }
        const curl = backPreviewRef.current;
        applyCurl(curl, backDragCornerPosition(curl.c, dx, dy, curl.w, curl.h, curl.face));
        return;
      }
      if (backPreviewRef.current) {
        backPreviewRef.current.root.remove();
        backPreviewRef.current = null;
      }
      if (dx < 0 && canGo(dx)) {
        if (!dragCurlRef.current) {
          // Grab the corner nearest the finger: the bottom corner when the
          // touch is in the lower part of the visible page, else the top.
          const rect = boundary.getBoundingClientRect();
          const visibleTop = Math.max(rect.top, 0);
          const visibleBottom = Math.min(rect.bottom, window.innerHeight);
          // Beneath it: the next page as last seen this session, else plain paper.
          const target = targetHref(dx);
          const snapshot = target ? pageSnapshots.get(pathOf(target)) : undefined;
          const curl = makeCurl(boundary, startY > (visibleTop + visibleBottom) / 2, undefined, snapshot ?? "blank");
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
    }

    /** Swipe released short of committing: the corner falls back flat (or the previous page drops back past the spine). */
    // 2026-10-19: cancellation owns removal too, after the drag refs are cleared.
    function settle() {
      stopSettle?.();
      const back = backPreviewRef.current;
      backPreviewRef.current = null;
      if (back) {
        const stop = runCurl(back, back.p, backDragCornerPosition(back.c, 0, 0, back.w, back.h), SETTLE_MS, {
          onDone: () => {
            stopSettle = null;
            back.root.remove();
          },
        });
        stopSettle = () => {
          stop();
          back.root.remove();
          stopSettle = null;
        };
        return;
      }
      const curl = dragCurlRef.current;
      dragCurlRef.current = null;
      if (curl) {
        const stop = runCurl(curl, curl.p, curl.c, SETTLE_MS, {
          onDone: () => {
            stopSettle = null;
            curl.root.remove();
            if (!flightRef.current) boundary.style.opacity = "";
          },
        });
        stopSettle = () => {
          stop();
          curl.root.remove();
          stopSettle = null;
          if (!flightRef.current) boundary.style.opacity = "";
        };
      }
    }

    // 2026-10-19: recover interrupted drags/settles without disturbing a real turn.
    function dropGesture() {
      disposeGesture?.();
      disposeGesture = null;
      startX = null;
      stopSettle?.();
      dropDragCurl();
      if (!flightRef.current) boundary.style.opacity = "";
    }

    function onStart(e: TouchEvent) {
      if (startX === null) dropGesture();
      if (e.touches.length > 1 || activeIndexRef.current < 0) {
        dropGesture();
        return;
      }
      // A new swipe while a page is still turning: land the turn now so
      // fast consecutive swipes are never dropped.
      // (Also while the new page is only waiting for its content to replace
      // its loading skeleton — it has rendered; don't swallow the swipe.)
      if (flightRef.current?.arrived || flightRef.current?.live) endFlight();
      else if (flightRef.current) {
        startX = null;
        return;
      }
      disposeGesture?.();
      if (!e.target) return;
      disposeGesture = listenToTouchGesture<TouchEvent>(e.target, onMove, onEnd);
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
      disposeGesture?.();
      disposeGesture = null;
      if (startX === null || blocked || axis !== "horizontal") {
        startX = null;
        return;
      }
      startX = null;
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && closesBook(dx)) {
        settle();
        edgesRef.current.onCloseBook?.();
        return;
      }
      const href = Math.abs(dx) >= SWIPE_THRESHOLD_PX ? targetHref(dx) : null;
      if (href) {
        start(dx < 0 ? 1 : -1, dragCurlRef.current, !hrefsRef.current.includes(href));
        router.push(href);
        return;
      }
      settle();
    }

    function onPageHide() {
      dropGesture();
    }
    function onVisibilityChange() {
      if (document.hidden) dropGesture();
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      dropGesture();
      el.removeEventListener("touchstart", onStart);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
    <div ref={wrapperRef} data-turn-page="" className="min-h-[calc(100dvh-25rem)]">
      {children}
    </div>
  );
}
