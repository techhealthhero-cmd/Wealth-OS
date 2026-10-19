"use client";

import { useEffect, useRef, useState } from "react";

import { formatMoney } from "@/lib/financial/money";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

/**
 * Splits an already-formatted money string into its main part and its
 * decimal part ("-฿249,999" + ".35"; "-249.999" + ",35 €"), purely on the
 * string — no money math. Returns `decimal: ""` when there is no fraction.
 */
export function splitFormattedMoney(formatted: string): { main: string; decimal: string } {
  const match = /^(.*\d)([.,]\d{2}\D*)$/.exec(formatted);
  return match ? { main: match[1], decimal: match[2] } : { main: formatted, decimal: "" };
}

/**
 * Hero-sized money figure with a smaller decimal part. Same one-shot
 * count-up as AnimatedNumber (skipped under prefers-reduced-motion); the
 * visible digits are aria-hidden and the full final value is read instead.
 */
export function SplitMoneyAmount({
  cents,
  currencyCode,
  className,
  decimalClassName,
  durationMs = 600,
}: {
  cents: number;
  currencyCode?: string;
  className?: string;
  decimalClassName?: string;
  durationMs?: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  // The reduced-motion hook reports false on the server/hydration pass and
  // only flips afterwards, so derive the shown value instead of trusting
  // useState's initializer — otherwise reduced motion would stick at 0.
  // Animation progress (0..1), not a stored value: an interrupted run (e.g.
  // React StrictMode's dev double-effect) simply restarts instead of sticking
  // at 0. The count-up plays once per mount: a `cents` change during it
  // retargets the remaining frames to the new value (no restart), and a
  // change after it shows the new value immediately.
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (reducedMotion || doneRef.current) return;
    const start = performance.now();
    let frame: number;
    function tick(now: number) {
      const next = Math.min(1, (now - start) / durationMs);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
      else doneRef.current = true;
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, reducedMotion]);

  const shown = reducedMotion || progress >= 1 ? cents : cents * (1 - Math.pow(1 - progress, 3));
  const { main, decimal } = splitFormattedMoney(formatMoney(Math.round(shown), currencyCode));

  return (
    <span className={className}>
      <span className="sr-only">{formatMoney(cents, currencyCode)}</span>
      <span aria-hidden="true">
        {main}
        {decimal ? <span className={decimalClassName}>{decimal}</span> : null}
      </span>
    </span>
  );
}
