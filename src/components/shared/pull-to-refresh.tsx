"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useActiveNavIndex } from "@/components/layout/use-active-nav-index";

const PULL_THRESHOLD_PX = 70;
const MAX_PULL_PX = 110;
// Pulling 1px of finger movement moves the indicator less than 1px —
// mirrors the "rubber band" resistance of native pull-to-refresh instead
// of a 1:1 drag, which reads as physically real rather than sluggish.
const PULL_DAMPING = 0.5;
// Dead-zone before the gesture commits to a pull and starts calling
// preventDefault(). Reported bug: scrolling sometimes got stuck. Root
// cause candidate: the old code called preventDefault() on the very
// first pixel of any downward touch movement at scrollY 0 — that hijacks
// the gesture before the browser/OS has resolved what it actually is
// (a deliberate pull vs. a normal scroll's initial jitter, a tap-drag, an
// edge back-swipe), and on some Android WebViews an aggressively
// prevented gesture can be left in a state where neither touchmove nor
// touchend/touchcancel ever reach us again, leaving pull state stuck.
// Waiting for a small real displacement first gives ordinary
// interactions room to resolve as "not a pull" before we ever touch
// preventDefault().
const PULL_START_THRESHOLD_PX = 10;

// Reported: reopening the app (or switching back to it after backgrounding)
// often showed stale/incomplete data, sometimes requiring several force-
// quit-and-reopen cycles. Root cause: mobile browsers/PWAs frequently
// SUSPEND a backgrounded tab rather than truly reloading it, so the
// already-rendered React tree (and whatever it fetched last time — possibly
// mid-load or from before a redeploy) is simply what's still on screen when
// the user returns; nothing tells Next.js to refetch. `visibilitychange` ->
// `router.refresh()` is the standard fix, reusing the exact same "refetch
// the current route's Server Component data, no full reload, no client
// state lost" mechanism the pull gesture below already uses. Gated to only
// fire after being hidden at least this long — a brief app-switcher glance
// (checking a notification, answering a call) shouldn't trigger a refetch
// the user won't perceive as needed, only a genuine "was away for a while."
const MIN_HIDDEN_MS_BEFORE_REFRESH = 30_000;

// Requested: swipe left/right between the 5 main tabs (same order as
// BottomNav) from anywhere in the page, not just by tapping the nav bar.
// Swipe left (finger moves right-to-left) -> next tab; swipe right ->
// previous tab — the same direction convention as iOS Photos/ViewPager/etc.
// Distance-based commit, no wrap-around at the first/last tab, and no-op on
// a page that isn't one of the 5 sections (e.g. /profile) since there's no
// defined "current position" to move relative to.
const SWIPE_NAV_THRESHOLD_PX = 60;
// Shared with the pull gesture's own dead-zone concept, but this one decides
// which AXIS a touch belongs to (horizontal swipe-nav vs. vertical pull)
// before either gesture commits — see the touchmove handler below for why
// that has to happen once, up front, rather than letting both gestures race
// independently off the same raw touch data.
const AXIS_LOCK_THRESHOLD_PX = 10;

/**
 * Checks whether `target` sits inside an element that natively scrolls its
 * own overflow horizontally (e.g. MoneyTabs/PlanTabs/EarnTabs' segmented-
 * control strip, the Help page's story-page gallery) — walked up to
 * `boundary` (this component's own container, so the walk can't escape into
 * unrelated ancestors). The horizontal swipe-nav gesture below defers to
 * these entirely rather than hijacking the drag into a tab switch: without
 * this check, swiping to see money/liabilities/etc. in an overflowing tab
 * strip would instead navigate away from the page halfway through the
 * gesture.
 *
 * Reported: swipe-nav didn't work ANYWHERE on the money page, not just over
 * the tab strip. Root cause: `scrollWidth > clientWidth` alone doesn't mean
 * an element is actually touch-scrollable — an element with `overflow-x:
 * hidden` (e.g. `<main>`'s own `overflow-x-hidden` in (app)/layout.tsx) and
 * an oversized descendant shows that exact same mismatch, but can never
 * respond to a touch-drag (there's nothing to scroll to; the overflow is
 * just clipped, not reachable) — confirmed by reproducing it locally
 * (a plain 600px-wide child inside a 368px `overflow-x:hidden` parent
 * reports `scrollWidth: 600, clientWidth: 368` despite being firmly
 * non-scrollable). This app has hit exactly this class of bug before (see
 * the "Mobile overflow fix" comment in (app)/layout.tsx re: wide flex
 * descendants needing `min-w-0`) — if any such descendant exists anywhere
 * on a page, the scrollWidth mismatch alone would make nearly every touch
 * point on that whole page look like "inside a horizontal scroller" to the
 * old version of this check. Requiring the computed `overflow-x` to
 * actually be `auto`/`scroll` (the only values a touch-drag can act on)
 * excludes only genuine scroll containers.
 */
function isInsideHorizontalScroller(target: EventTarget | null, boundary: HTMLElement): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== boundary) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Custom pull-to-refresh for the installed-PWA app shell, plus horizontal
 * swipe navigation between the 5 main tabs. `display: "standalone"`
 * (manifest.ts) means the OS/browser's own native pull-to-refresh gesture is
 * unavailable once the app is added to the home screen — the vertical half
 * of this restores that expected gesture. Re-fetches the current route's
 * Server Component data via router.refresh() (no full page reload, no
 * client-side data-fetching duplicated here).
 *
 * Both gestures share one touch lifecycle rather than two independent
 * listeners: a horizontal swipe and a vertical pull both start as "some
 * displacement in some direction," and letting each gesture's own listener
 * independently decide "is this mine?" off the same raw touch stream risks
 * both partially reacting to the same real-world diagonal-ish drag (e.g. the
 * pull indicator peeking in briefly during a mostly-horizontal swipe).
 * Deciding the axis once, in a shared dead zone (`AXIS_LOCK_THRESHOLD_PX`),
 * before either gesture commits to anything, avoids that.
 *
 * touchmove is bound manually with `{ passive: false }` rather than as a
 * JSX prop — React attaches JSX touch handlers as passive listeners by
 * default, where calling preventDefault() is a silent no-op (and logs a
 * console warning); only a manually-attached non-passive listener can
 * actually suppress the browser's own scroll/bounce while dragging.
 *
 * The pull gesture's live distance is tracked in a ref (`pullDistanceRef`),
 * not just the `pullDistance` state used for rendering — reading it in
 * `handleTouchEnd` via the ref means the effect only needs to depend on
 * `[isPending, router]`, so the listeners stay bound for the whole drag
 * instead of being torn down and rebound on every touchmove frame. The
 * active tab index is read the same way (`activeIndexRef`), kept in sync
 * on every render, so a route change doesn't require rebinding either.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const activeIndex = useActiveNavIndex();
  const [isPending, startTransition] = useTransition();
  const [pullDistance, setPullDistance] = useState(0);
  const pullDistanceRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const axisRef = useRef<"horizontal" | "vertical" | null>(null);
  const skipSwipeNavRef = useRef(false);
  const isPullingRef = useRef(false);
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  function updatePullDistance(value: number) {
    pullDistanceRef.current = value;
    setPullDistance(value);
  }

  useEffect(() => {
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      // Just became visible again.
      if (hiddenAt !== null && Date.now() - hiddenAt >= MIN_HIDDEN_MS_BEFORE_REFRESH) {
        startTransition(() => {
          router.refresh();
        });
      }
      hiddenAt = null;
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [router]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Captured here (not re-read from `el` inside the closures below): TS's
    // control-flow narrowing from the `if (!el) return` above doesn't
    // survive into a function declaration that's only invoked later (as
    // these event listeners are) — a fresh binding whose inferred type is
    // non-null at ITS OWN declaration site sidesteps that.
    const boundary: HTMLElement = el;

    function resetGesture() {
      startYRef.current = null;
      startXRef.current = null;
      axisRef.current = null;
      skipSwipeNavRef.current = false;
      isPullingRef.current = false;
      updatePullDistance(0);
    }

    function handleTouchStart(e: TouchEvent) {
      if (isPending) {
        startYRef.current = null;
        startXRef.current = null;
        return;
      }
      // Deliberately NOT gated on `window.scrollY === 0` here (unlike the
      // old pull-only version) — swipe-nav should work from anywhere on the
      // page, not just at the top. The scroll-position check that used to
      // live here now lives only in the vertical branch below, where it
      // actually belongs.
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isPullingRef.current = false;
      axisRef.current = null;
      skipSwipeNavRef.current = isInsideHorizontalScroller(e.target, boundary);
    }

    function handleTouchMove(e: TouchEvent) {
      if (startYRef.current === null || startXRef.current === null) return;
      // A second touch point (pinch, or the OS's own edge-swipe gesture)
      // means this was never a single-finger gesture — release it back to
      // the browser instead of racing it.
      if (e.touches.length > 1) {
        resetGesture();
        return;
      }

      const dx = e.touches[0].clientX - startXRef.current;
      const dy = e.touches[0].clientY - startYRef.current;

      if (axisRef.current === null) {
        if (Math.abs(dx) < AXIS_LOCK_THRESHOLD_PX && Math.abs(dy) < AXIS_LOCK_THRESHOLD_PX) {
          // Still inside the shared dead-zone — don't commit to either
          // gesture yet, so a normal tap/scroll/back-swipe is free to
          // resolve as itself.
          return;
        }
        axisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }

      if (axisRef.current === "horizontal") {
        // Only claim the gesture (and block whatever native behavior it
        // would otherwise have, e.g. a browser edge-swipe) when a tab
        // switch could actually result from it — a page with no active tab
        // (e.g. /profile) has nothing for swipe-nav to do, so there's no
        // reason to swallow the touch's default behavior there.
        if (!skipSwipeNavRef.current && activeIndexRef.current !== -1) {
          // Same "wait for real displacement before preventDefault"
          // philosophy as the pull gesture below — only once the axis has
          // actually resolved to horizontal, not on the gesture's first
          // pixel.
          e.preventDefault();
        }
        // No visual drag-follow for swipe-nav — the tab switch itself
        // (decided in handleTouchEnd) is the only feedback, same as a
        // native swipe-between-pages control.
        return;
      }

      // axisRef.current === "vertical" from here on — unchanged pull logic.
      if (window.scrollY > 0) {
        startYRef.current = null;
        isPullingRef.current = false;
        updatePullDistance(0);
        return;
      }
      if (dy <= 0) {
        isPullingRef.current = false;
        updatePullDistance(0);
        return;
      }
      if (!isPullingRef.current && dy < PULL_START_THRESHOLD_PX) {
        return;
      }
      isPullingRef.current = true;
      e.preventDefault();
      updatePullDistance(Math.min((dy - PULL_START_THRESHOLD_PX) * PULL_DAMPING, MAX_PULL_PX));
    }

    function handleTouchEnd(e: TouchEvent) {
      if (
        axisRef.current === "horizontal" &&
        !skipSwipeNavRef.current &&
        startXRef.current !== null &&
        e.changedTouches.length > 0
      ) {
        const dx = e.changedTouches[0].clientX - startXRef.current;
        const currentIndex = activeIndexRef.current;
        if (Math.abs(dx) >= SWIPE_NAV_THRESHOLD_PX && currentIndex !== -1) {
          const nextIndex = currentIndex + (dx < 0 ? 1 : -1);
          if (nextIndex >= 0 && nextIndex < NAV_ITEMS.length) {
            router.push(NAV_ITEMS[nextIndex].href);
          }
        }
      } else if (isPullingRef.current && pullDistanceRef.current >= PULL_THRESHOLD_PX) {
        startTransition(() => {
          router.refresh();
        });
      }
      resetGesture();
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isPending, router]);

  const showIndicator = pullDistance > 0 || isPending;
  const indicatorHeight = isPending ? PULL_THRESHOLD_PX : pullDistance;
  const readyToRelease = pullDistance >= PULL_THRESHOLD_PX;

  return (
    <div ref={containerRef}>
      <div
        aria-hidden={!showIndicator}
        className="flex items-center justify-center overflow-hidden text-muted-foreground transition-[height] duration-150 ease-(--ease-standard)"
        style={{ height: showIndicator ? indicatorHeight : 0 }}
      >
        <RefreshCw
          className={cn("size-5", isPending && "animate-spin")}
          style={!isPending ? { transform: `rotate(${Math.min(pullDistance / PULL_THRESHOLD_PX, 1) * 360}deg)` } : undefined}
          aria-hidden="true"
        />
        <span className="sr-only" role="status">
          {isPending ? t("common.refreshing") : readyToRelease ? t("common.releaseToRefresh") : ""}
        </span>
      </div>
      {children}
    </div>
  );
}
