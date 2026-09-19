"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

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

/**
 * Custom pull-to-refresh for the installed-PWA app shell. `display:
 * "standalone"` (manifest.ts) means the OS/browser's own native
 * pull-to-refresh gesture is unavailable once the app is added to the home
 * screen — this restores the same expected gesture. Re-fetches the current
 * route's Server Component data via router.refresh() (no full page
 * reload, no client-side data-fetching duplicated here).
 *
 * touchmove is bound manually with `{ passive: false }` rather than as a
 * JSX prop — React attaches JSX touch handlers as passive listeners by
 * default, where calling preventDefault() is a silent no-op (and logs a
 * console warning); only a manually-attached non-passive listener can
 * actually suppress the browser's own scroll/bounce while dragging.
 *
 * The gesture's live distance is tracked in a ref (`pullDistanceRef`), not
 * just the `pullDistance` state used for rendering — reading it in
 * `handleTouchEnd` via the ref means the effect only needs to depend on
 * `[isPending, router]`, so the listeners stay bound for the whole drag
 * instead of being torn down and rebound on every touchmove frame.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [pullDistance, setPullDistance] = useState(0);
  const pullDistanceRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  function updatePullDistance(value: number) {
    pullDistanceRef.current = value;
    setPullDistance(value);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || isPending) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = false;
    }

    function handleTouchMove(e: TouchEvent) {
      if (startYRef.current === null) return;
      // A second touch point (pinch, or the OS's own edge-swipe gesture)
      // means this was never a single-finger pull — release it back to
      // the browser instead of racing it for the gesture.
      if (e.touches.length > 1) {
        startYRef.current = null;
        isPullingRef.current = false;
        updatePullDistance(0);
        return;
      }
      // Abandon the gesture the moment the page has scrolled away from the
      // top (e.g. content above grew) or the drag reverses upward — lets
      // normal scrolling resume untouched instead of fighting it.
      if (window.scrollY > 0) {
        startYRef.current = null;
        isPullingRef.current = false;
        updatePullDistance(0);
        return;
      }
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        isPullingRef.current = false;
        updatePullDistance(0);
        return;
      }
      if (!isPullingRef.current && delta < PULL_START_THRESHOLD_PX) {
        // Still inside the dead-zone — don't preventDefault yet, so a
        // normal scroll/tap/back-swipe is free to resolve as itself.
        return;
      }
      isPullingRef.current = true;
      e.preventDefault();
      updatePullDistance(Math.min((delta - PULL_START_THRESHOLD_PX) * PULL_DAMPING, MAX_PULL_PX));
    }

    function handleTouchEnd() {
      if (isPullingRef.current && pullDistanceRef.current >= PULL_THRESHOLD_PX) {
        startTransition(() => {
          router.refresh();
        });
      }
      startYRef.current = null;
      isPullingRef.current = false;
      updatePullDistance(0);
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
