import Link from "next/link";
import type { ReactNode } from "react";

import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";

const TILE = "flex min-w-0 flex-col rounded-[20px] border bg-card px-3.5 pt-3.5 pb-3 text-card-foreground shadow-card";
const LINK_TILE =
  "card-interactive outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function TileTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
      <h3 className="min-w-0 text-[12.5px] leading-5 font-medium text-muted-foreground">{children}</h3>
      {aside}
    </div>
  );
}

export interface HomeCushionTilesLabels {
  cushionTitle: string;
  monthsUnit: string;
  /** Contains {months}. */
  cushionTarget: string;
  /** Contains {months}. */
  cushionReached: string;
  /** Contains {months}. */
  cushionSr: string;
  cushionNotSetUp: string;
  cushionSetUpCta: string;
  cushionNeedsExpenses: string;
  safeTitle: string;
  /** Contains {amount}. */
  safePerDay: string;
  safeCaption: string;
  safeIncomplete: string;
}

export type HomeCushionEmergency =
  | { status: "ready"; monthsProtected: number; targetMonths: number | null }
  | { status: "not_set_up" }
  | { status: "needs_expenses" };

export interface HomeCushionTilesProps {
  /** Months protected comes from calculateMonthsProtected() — never computed here. */
  emergency: HomeCushionEmergency;
  /** Existing getSafeToSpend() result; null when it lacks the data to compute. */
  safeToSpend: { thisMonthCents: number; todayCents: number } | null;
  currencyCode?: string;
  labels: HomeCushionTilesLabels;
}

const CELLS = 12;

function formatMonths(months: number) {
  return Number.isInteger(months) ? String(months) : months.toFixed(1);
}

/**
 * "Cash cushion" (emergency-fund months) and "Left to spend this month"
 * (safe-to-spend) — both already-computed values from the existing
 * engines, shown as two small tiles. Plain props only.
 */
export function HomeCushionTiles({ emergency, safeToSpend, currencyCode, labels }: HomeCushionTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href="/plan/emergency-fund" className={cn(TILE, LINK_TILE)}>
        <TileTitle>{labels.cushionTitle}</TileTitle>
        {emergency.status === "ready" ? (
          <CushionMonths emergency={emergency} labels={labels} />
        ) : (
          emergency.status === "not_set_up" ? (
            <>
              <p className="mt-1.5 text-[13.5px] leading-snug font-semibold">{labels.cushionNotSetUp}</p>
              <p className="mt-0.5 text-[11.5px] leading-[17px] font-medium text-primary dark:text-[#8fd9b4]">
                {labels.cushionSetUpCta}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[11.5px] leading-[17px] text-muted-foreground">{labels.cushionNeedsExpenses}</p>
          )
        )}
      </Link>

      <Link href="/money/budget" className={cn(TILE, LINK_TILE)}>
        <TileTitle>{labels.safeTitle}</TileTitle>
        {safeToSpend ? (
          <>
            <p className="mt-0.5 text-xl leading-7 font-bold tabular-nums [overflow-wrap:anywhere]">
              {formatMoney(safeToSpend.thisMonthCents, currencyCode, undefined, 0)}
            </p>
            <p className="mt-2 text-[11.5px] leading-[17px] font-medium text-foreground tabular-nums">
              {labels.safePerDay.replace("{amount}", formatMoney(safeToSpend.todayCents, currencyCode, undefined, 0))}
            </p>
            <p className="text-[11.5px] leading-[17px] text-muted-foreground">{labels.safeCaption}</p>
          </>
        ) : (
          <p className="mt-1.5 text-[11.5px] leading-[17px] text-muted-foreground">{labels.safeIncomplete}</p>
        )}
      </Link>
    </div>
  );
}

function CushionMonths({
  emergency,
  labels,
}: {
  emergency: Extract<HomeCushionEmergency, { status: "ready" }>;
  labels: HomeCushionTilesLabels;
}) {
  const { monthsProtected, targetMonths } = emergency;
  const shown = formatMonths(monthsProtected);
  const target = targetMonths !== null && targetMonths > 0 ? targetMonths : null;
  const reached = target !== null && monthsProtected >= target;
  return (
    <>
      <p className="mt-0.5 text-xl leading-7 font-bold tabular-nums">
        ~{shown}
        <span className="ml-1 text-xs font-medium text-muted-foreground">{labels.monthsUnit}</span>
      </p>
      <div role="img" aria-label={labels.cushionSr.replace("{months}", shown)} className="relative mt-2.5 grid grid-cols-12 gap-0.5">
        {Array.from({ length: CELLS }, (_, i) => {
          const fill = Math.max(0, Math.min(1, monthsProtected - i));
          return (
            <span key={i} className="h-2 overflow-hidden rounded-[2px] bg-muted dark:bg-white/10">
              {fill > 0 ? (
                <span className="block h-full bg-[#8fb9a2] dark:bg-[#5fae8c]" style={{ width: `${fill * 100}%` }} />
              ) : null}
            </span>
          );
        })}
        {target !== null && target <= CELLS ? (
          <span
            aria-hidden="true"
            className="absolute -top-[3px] -bottom-[3px] w-0.5 -translate-x-1/2 rounded-full bg-[#b99a65]"
            style={{ left: `${(target / CELLS) * 100}%` }}
          />
        ) : null}
      </div>
      {target !== null ? (
        <p
          className={cn(
            "mt-2 text-[11.5px] leading-[17px]",
            reached ? "font-medium text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
          )}
        >
          {(reached ? labels.cushionReached : labels.cushionTarget).replace("{months}", formatMonths(target))}
        </p>
      ) : null}
    </>
  );
}
