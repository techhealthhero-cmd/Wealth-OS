import Link from "next/link";
import { CircleHelp } from "lucide-react";

import { formatMoney } from "@/lib/financial/money";
import { calculateYearlyBalance } from "@/lib/financial/yearly-balance";
import { cn } from "@/lib/utils";

export interface YearlyBalanceStripProps {
  incomeCents: number;
  expensesCents: number;
  /** Already-formatted, e.g. "ม.ค. – ต.ค." */
  rangeLabel: string;
  helpHref: string;
  currencyCode: string;
  labels: {
    stripLabel: string;
    surplus: string;
    deficit: string;
    even: string;
    barAria: string;
    whyYearly: string;
    income: string;
    expenses: string;
  };
}

/** Rounded to whole baht: a supporting figure shouldn't read as long as the headline. */
function formatCompact(cents: number, currencyCode: string) {
  return formatMoney(cents, currencyCode, undefined, 0);
}

/**
 * Year-to-date income vs expenses, as a quiet row at the foot of the Net
 * Worth hero (2026-10-24, design H3). It used to be its own card with a
 * headline-sized number, which competed with Net Worth for attention; here
 * it reads as supporting context. A green income bar pushes from the left
 * against a red expense bar from the right; the dot marks where they meet.
 * Yearly on purpose — see /help#yearly-view.
 */
export function YearlyBalanceStrip({
  incomeCents,
  expensesCents,
  rangeLabel,
  helpHref,
  currencyCode,
  labels,
}: YearlyBalanceStripProps) {
  const balance = calculateYearlyBalance(incomeCents, expensesCents);
  const isShort = balance.status === "deficit";
  const incomeText = formatCompact(balance.incomeCents, currencyCode);
  const expensesText = formatCompact(balance.expensesCents, currencyCode);
  const statusLabel = balance.status === "surplus" ? labels.surplus : isShort ? labels.deficit : labels.even;
  const meet = balance.meetingPointPercent;

  return (
    <div className="space-y-2 border-t border-primary-foreground/15 pt-3" data-stop-navigation>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center">
          <p className="truncate text-sm text-primary-foreground/75">
            {labels.stripLabel.replace("{range}", rangeLabel)} {statusLabel}
          </p>
          <Link
            href={helpHref}
            aria-label={labels.whyYearly}
            className="-my-3 flex size-11 shrink-0 items-center justify-center text-primary-foreground/60 hover:text-primary-foreground"
          >
            <CircleHelp className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <p
          className={cn(
            "shrink-0 text-lg font-bold tabular-nums",
            isShort ? "text-rose-200" : "text-[#8FE3BC]"
          )}
        >
          {balance.netCents > 0 ? "+" : ""}
          {formatCompact(balance.netCents, currencyCode)}
        </p>
      </div>

      <div
        className="relative h-4"
        role="img"
        aria-label={labels.barAria.replace("{income}", incomeText).replace("{expenses}", expensesText)}
      >
        <div className="absolute inset-x-0 top-1 flex h-2 overflow-hidden rounded-full bg-primary-foreground/10">
          <span
            className="h-full bg-[#6FD3A5] transition-[width] duration-(--motion-value) ease-(--ease-standard)"
            style={{ width: `${meet}%` }}
          />
          <span className="h-full flex-1 bg-[#F08A8F]" />
        </div>
        <span
          className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[repeating-linear-gradient(180deg,currentColor_0_3px,transparent_3px_6px)] text-primary-foreground opacity-45"
          aria-hidden="true"
        />
        <span
          className="absolute top-2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[color-mix(in_oklab,var(--primary)_80%,black)] bg-[#E2C277] transition-[left] duration-(--motion-value) ease-(--ease-standard)"
          style={{ left: `${meet}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="flex justify-between gap-3 text-[11px] text-primary-foreground/60 tabular-nums">
        <span>
          {labels.income} {incomeText}
        </span>
        <span>
          {labels.expenses} {expensesText}
        </span>
      </div>
    </div>
  );
}
