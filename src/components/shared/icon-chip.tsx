import type { LucideIcon } from "lucide-react";

import { cn } from "cn";

interface IconChipProps {
  icon: LucideIcon;
  tone?: "mint" | "slate" | "lavender" | "rose";
  className?: string;
}

// Soft pastel rounded-square chip, one solid tint per tone (no gradient) —
// matches the reference's feature-list icon chips. 2026-09 v2.4: uses the
// exact bright/muted "Apple-like" hex values (mint = income, slate =
// expense, lavender = a neutral third tone) instead of Tailwind's stock
// lime/sky/orange palette — no orange or saturated colors anywhere. "rose"
// (debt/liability, negative movement) reuses Tailwind's rose scale rather
// than a bespoke hex, matching the rose already used for negative-value
// text elsewhere in the dashboard (net-worth-hero.tsx, charts.tsx).
const TONE_CLASSES: Record<NonNullable<IconChipProps["tone"]>, string> = {
  mint: "bg-[#7FD6B2]/20 text-[#1F4D3E]",
  slate: "bg-[#8EA2B8]/20 text-[#3E4E5C]",
  lavender: "bg-[#B8B0CC]/25 text-[#5C5468]",
  rose: "bg-rose-500/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-400",
};

/**
 * Soft pastel icon chip (2026-09 reskin v2.4, bright muted "Apple-like"
 * finance direction) — used for decorative/card-header icon moments
 * (dashboard summary cards, earn/opportunity cards, settings menu icons,
 * feature lists). Functional nav/button icons stay bare per
 * GRAPHICS_PLAN.md's icon system rule — this is additive, not a
 * replacement for those.
 */
export function IconChip({ icon: Icon, tone = "mint", className }: IconChipProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
        TONE_CLASSES[tone],
        className
      )}
    >
      <Icon className="size-4" />
    </div>
  );
}
