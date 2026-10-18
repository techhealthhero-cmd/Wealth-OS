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
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (reducedMotion || startedRef.current) return;
    startedRef.current = true;
    const start = performance.now();
    let frame: number;
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(progress < 1 ? cents * eased : cents);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cents, durationMs, reducedMotion]);

  const shown = reducedMotion ? cents : display;
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
