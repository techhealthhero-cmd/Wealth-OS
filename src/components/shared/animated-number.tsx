"use client";

import { useEffect, useRef, useState } from "react";

import { formatMoney } from "@/lib/financial/money";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

type AnimatedNumberFormat = "money" | "percent1" | "integer";

interface AnimatedNumberProps {
  /** The final numeric value (cents, a percent, a score — whatever `formatAs` expects). */
  value: number;
  /**
   * How to format the (possibly still-interpolating) numeric value. A fixed
   * discriminator rather than an arbitrary `(value) => string` function —
   * this component is rendered from Server Component parents (NetWorthHero,
   * SummaryCards), and functions can't be passed as props across the
   * server/client boundary in the App Router. `formatMoney` itself is
   * imported directly here instead.
   */
  formatAs: AnimatedNumberFormat;
  /** Only used when `formatAs` is "money". */
  currencyCode?: string;
  /** 400-700ms per the motion spec for financial values/progress. */
  durationMs?: number;
  className?: string;
}

function format(value: number, formatAs: AnimatedNumberFormat, currencyCode?: string): string {
  switch (formatAs) {
    case "money":
      return formatMoney(value, currencyCode);
    case "percent1":
      return `${value.toFixed(1)}%`;
    case "integer":
      return value.toFixed(0);
  }
}

/**
 * Short count-up for a handful of important financial numbers (Net Worth,
 * Wealth Score, Income/Expense, Savings Rate) on first appearance — never a
 * decorative effect elsewhere.
 *
 * Runs exactly once per mount (a `startedRef` guard, not a dependency-array
 * trick) — this app's dashboard numbers all come from a single Server
 * Component data fetch per page load, so in practice a mounted
 * AnimatedNumber's `value` never actually changes underneath it; the guard
 * exists so React re-renders (e.g. a parent re-rendering for an unrelated
 * reason) can never replay the animation.
 *
 * `prefers-reduced-motion` skips the animation entirely: the initial state
 * itself is the final value (no reduced-motion branch runs inside the
 * effect), so there's no flash of an intermediate frame — the global CSS
 * kill switch in globals.css only covers CSS animation/transition, not this
 * rAF-driven interpolation, so it's checked explicitly via
 * usePrefersReducedMotion.
 */
export function AnimatedNumber({ value, formatAs, currencyCode, durationMs = 600, className }: AnimatedNumberProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(() => (reducedMotion ? value : 0));
  const startedRef = useRef(false);

  useEffect(() => {
    if (reducedMotion || startedRef.current) return;
    startedRef.current = true;

    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(value * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs, reducedMotion]);

  return <span className={className}>{format(display, formatAs, currencyCode)}</span>;
}
