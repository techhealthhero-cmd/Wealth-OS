"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD_PX = 70;
const MAX_PULL_PX = 110;
// Progress ring geometry (24-unit viewBox).
const RING_R = 9;
const RING_C = 2 * Math.PI * RING_R;
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

// Swipe left/right between the 5 main tabs was REMOVED (requested
// 2026-10-08): tabs change only by tapping the bottom nav. This still
// decides which AXIS a touch belongs to before the pull commits, so a
// mostly-horizontal drag (a swipe-to-delete row, a scrolling tab strip)
// never also starts a pull-to-refresh.
const AXIS_LOCK_THRESHOLD_PX = 10;

/**
 * Custom pull-to-refresh for the installed-PWA app shell. `display:
 * "standalone"` (manifest.ts) means the OS/browser's own native pull-to-
 * refresh gesture is unavailable once the app is added to the home screen —
 * this restores that expected gesture. Re-fetches the current route's Server
 * Component data via router.refresh() (no full page reload, no client-side
 * data-fetching duplicated here).
 *
 * The touch's axis is decided once, in a dead zone
 * (`AXIS_LOCK_THRESHOLD_PX`), before the pull commits to anything: a mostly-
 * horizontal drag is left entirely to the browser (and to elements with
 * their own horizontal gesture), so the pull indicator never peeks in
 * during a sideways swipe.
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
  const startXRef = useRef<number | null>(null);
  const axisRef = useRef<"horizontal" | "vertical" | null>(null);
  const isPullingRef = useRef(false);

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

    function resetGesture() {
      startYRef.current = null;
      startXRef.current = null;
      axisRef.current = null;
      isPullingRef.current = false;
      updatePullDistance(0);
    }

    function handleTouchStart(e: TouchEvent) {
      if (isPending) {
        startYRef.current = null;
        startXRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isPullingRef.current = false;
      axisRef.current = null;
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
          // Still inside the dead-zone — don't commit yet, so a normal
          // tap/scroll/back-swipe is free to resolve as itself.
          return;
        }
        axisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }

      // Sideways drags are never ours (tabs change only via the bottom nav).
      if (axisRef.current === "horizontal") return;

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

    function handleTouchEnd() {
      if (isPullingRef.current && pullDistanceRef.current >= PULL_THRESHOLD_PX) {
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
  // 0 → 1 as the finger pulls to the release point (1 while refreshing).
  const progress = isPending ? 1 : Math.min(pullDistance / PULL_THRESHOLD_PX, 1);
  const label = isPending ? t("common.refreshing") : readyToRelease ? t("common.releaseToRefresh") : t("common.pullToRefresh");

  return (
    <div ref={containerRef}>
      <div
        aria-hidden={!showIndicator}
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150 ease-(--ease-standard)"
        style={{ height: showIndicator ? indicatorHeight : 0 }}
      >
        {/* Redesigned 2026-10-04 (the bare spinning arrows "didn't look
            nice"): a small frosted pill whose ring FILLS as you pull — so
            you can see how far is left — turns the app's green and pops
            slightly once releasing will refresh, then becomes a spinning
            arc with a shimmering "refreshing…" while it works. */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border bg-card/90 py-2 pr-4 pl-2.5 shadow-md backdrop-blur-md transition-[scale,border-color] duration-200 ease-(--ease-companion)",
            readyToRelease || isPending ? "scale-100 border-primary/40" : "scale-95"
          )}
          style={{ opacity: isPending ? 1 : Math.min(1, progress * 1.6) }}
        >
          <svg viewBox="0 0 24 24" className={cn("size-[22px] shrink-0", isPending && "animate-spin")} aria-hidden="true">
            <circle cx="12" cy="12" r={RING_R} fill="none" strokeWidth="2.5" className="stroke-muted" />
            <circle
              cx="12"
              cy="12"
              r={RING_R}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              stroke="var(--primary)"
              strokeDasharray={RING_C}
              // While refreshing, a 30% arc spins; while pulling, the ring
              // fills clockwise from the top in step with the finger.
              strokeDashoffset={isPending ? RING_C * 0.7 : RING_C * (1 - progress)}
              transform="rotate(-90 12 12)"
              className="transition-[stroke-dashoffset] duration-75"
            />
          </svg>
          <span
            className={cn(
              "text-[13px] font-medium whitespace-nowrap",
              isPending ? "live-status-text" : readyToRelease ? "text-primary" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
        </div>
        <span className="sr-only" role="status">
          {isPending ? t("common.refreshing") : readyToRelease ? t("common.releaseToRefresh") : ""}
        </span>
      </div>
      {children}
    </div>
  );
}
