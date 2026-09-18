"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 2026-09 Home redesign: the "financial command center" Home page shows
 * only decision-relevant content by default (Net Worth, Next Best Action,
 * this month's snapshot, top goal, engagement) — everything else (charts,
 * the Wealth Score/Life Stage/Safe-to-Spend/Budget/Emergency Fund grid,
 * account/transaction previews) lives behind this one collapsed toggle.
 *
 * `children` are Server Components (async data fetches with their own
 * Suspense boundaries) passed straight through — a standard Next.js App
 * Router composition where a Client Component boundary only controls
 * whether already-resolved server output is mounted, not how it's fetched.
 * That data is still fetched on every page load regardless of whether this
 * is expanded — this is a scroll-height fix, not a fetch-cost one.
 */
export function DashboardDetailsToggle({ label, children }: { label: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 active:scale-[0.99]"
      >
        {label}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform duration-(--motion-normal) ease-(--ease-standard)", expanded && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div className="animate-in fade-in slide-in-from-top-1 duration-(--motion-normal) space-y-5">{children}</div>
      ) : null}
    </div>
  );
}
