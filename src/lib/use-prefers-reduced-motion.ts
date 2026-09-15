"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * 2026-09 motion system: the global CSS kill switch in globals.css already
 * neutralizes every `animation`/`transition` property under
 * prefers-reduced-motion — but JS-driven motion (a count-up number
 * interpolation, a chart library's own tween) isn't a CSS property and
 * needs an explicit check. `useSyncExternalStore` (not useState+useEffect)
 * avoids a first-render flash of the animated state before the media query
 * is read.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
