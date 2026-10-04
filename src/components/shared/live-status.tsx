"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

const LINE_MS = 1900;
const SHOW_ELAPSED_AFTER_S = 4;

/**
 * "Live status" (2026-10-04, modeled on how Claude makes waiting feel
 * shorter): instead of a static "loading…", say WHAT is happening, keep it
 * visibly alive, and be honest about time.
 *
 * - Cycles through `lines` (each a true description of the step in
 *   progress — never invented progress), settling on the last one if the
 *   wait outlasts them.
 * - Shimmering text (a light sweep across it) so it never looks frozen.
 * - After a few seconds, shows the elapsed seconds ("· 6 วิ") — knowing it
 *   is still working beats wondering whether it hung.
 *
 * Purely presentational; `aria-live="polite"` announces each step once.
 */
export function LiveStatus({ lines, className }: { lines: readonly string[]; className?: string }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const lineTimer = window.setInterval(() => setIndex((i) => Math.min(i + 1, lines.length - 1)), LINE_MS);
    const clock = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => {
      window.clearInterval(lineTimer);
      window.clearInterval(clock);
    };
  }, [lines.length]);

  const line = lines[Math.min(index, lines.length - 1)] ?? "";

  return (
    <span className={cn("inline-flex min-w-0 items-baseline gap-1.5", className)} aria-live="polite">
      <span key={index} className="live-status-text truncate animate-in fade-in slide-in-from-bottom-0.5 duration-300">
        {line}
      </span>
      {elapsed >= SHOW_ELAPSED_AFTER_S ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          · {t("common.elapsedSeconds").replace("{n}", String(elapsed))}
        </span>
      ) : null}
    </span>
  );
}
