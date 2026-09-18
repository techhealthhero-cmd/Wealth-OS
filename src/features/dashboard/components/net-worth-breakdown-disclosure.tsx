"use client";

import { useState } from "react";
import { ChevronDown, CreditCard, Wallet } from "lucide-react";

import { formatMoney } from "@/lib/financial/money";
import { IconChip } from "@/components/shared/icon-chip";
import { cn } from "@/lib/utils";

interface NetWorthBreakdownDisclosureProps {
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  viewDetailsLabel: string;
  assetsLabel: string;
  liabilitiesLabel: string;
  /** Matches NetWorthHero's isNegative-driven Card variant — "on-dark" for the highlight (dark green) card, "default" for the white/negative one. */
  tone: "default" | "on-dark";
}

/**
 * 2026-09 Home redesign: the assets/liabilities breakdown + proportion bar
 * used to be its own second Card on the dashboard (full detail also always
 * one tap away at /money/net-worth) — folded in here as a chevron-expand
 * section instead, so NetWorthHero renders a single Card by default. Same
 * expand/collapse pattern already used by wealth-score-card.tsx /
 * safe-to-spend-card.tsx / life-stage-card.tsx.
 */
export function NetWorthBreakdownDisclosure({
  totalAssetsCents,
  totalLiabilitiesCents,
  viewDetailsLabel,
  assetsLabel,
  liabilitiesLabel,
  tone,
}: NetWorthBreakdownDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  const totalCents = totalAssetsCents + totalLiabilitiesCents;
  const assetsPercent = totalCents > 0 ? (totalAssetsCents / totalCents) * 100 : 50;
  const liabilitiesPercent = 100 - assetsPercent;
  const mutedClass = tone === "on-dark" ? "text-primary-foreground/60" : "text-muted-foreground";

  return (
    // Excluded from the outer ClickableCard's navigation via closest()
    // lookup — same mechanism NetWorthInfoPopover already uses in this
    // same hero card.
    <div data-stop-navigation>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex items-center gap-1 text-xs font-medium transition-transform duration-(--motion-fast) active:scale-[0.98]",
          tone === "on-dark" ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-primary"
        )}
      >
        {viewDetailsLabel}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform duration-(--motion-normal) ease-(--ease-standard)", expanded && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div
          className={cn(
            "animate-in fade-in slide-in-from-top-1 duration-(--motion-normal) mt-3 space-y-3 border-t pt-3",
            tone === "on-dark" ? "border-primary-foreground/15" : ""
          )}
        >
          <div className="grid grid-cols-2 gap-3 text-sm sm:gap-6">
            <div className="flex min-w-0 items-start gap-2">
              <IconChip icon={Wallet} tone="mint" className="size-9" />
              <div className="min-w-0">
                <p className={mutedClass}>{assetsLabel}</p>
                <p className="whitespace-nowrap text-sm font-semibold tracking-tight tabular-nums sm:text-base">
                  {formatMoney(totalAssetsCents)}
                </p>
              </div>
            </div>
            <div
              className={cn(
                "flex min-w-0 items-start gap-2 border-l pl-3 sm:pl-6",
                tone === "on-dark" ? "border-primary-foreground/15" : ""
              )}
            >
              <IconChip icon={CreditCard} tone="rose" className="size-9" />
              <div className="min-w-0">
                <p className={mutedClass}>{liabilitiesLabel}</p>
                <p className="whitespace-nowrap text-sm font-semibold tracking-tight tabular-nums sm:text-base">
                  {formatMoney(totalLiabilitiesCents)}
                </p>
              </div>
            </div>
          </div>

          {totalCents > 0 ? (
            <div className="space-y-1.5">
              <div className={cn("flex h-2 w-full overflow-hidden rounded-full", tone === "on-dark" ? "bg-primary-foreground/15" : "bg-muted")}>
                <div className="h-full bg-[#7FD6B2]" style={{ width: `${assetsPercent}%` }} />
                <div className="h-full bg-rose-400" style={{ width: `${liabilitiesPercent}%` }} />
              </div>
              <div className={cn("flex justify-between text-xs", mutedClass)}>
                <span>
                  {assetsPercent.toFixed(0)}% {assetsLabel}
                </span>
                <span>
                  {liabilitiesPercent.toFixed(0)}% {liabilitiesLabel}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
