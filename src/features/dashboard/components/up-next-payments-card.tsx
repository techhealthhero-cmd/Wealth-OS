import Link from "next/link";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";
import { daysBetween, type MonthPaymentSummary, type PaymentOccurrence } from "@/lib/financial/payment-calendar";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import { KIND_ICON, KIND_TILE, formatShortDueDate, relativeDayLabel } from "@/features/recurring/lib/payment-display";

const CARD =
  "card-interactive block rounded-[20px] border bg-card text-card-foreground shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export interface UpNextPaymentsCardProps {
  /** Unpaid occurrences in due-date order (first is "next"); empty → empty state. */
  next: PaymentOccurrence[];
  /** This month's totals (paid = verified confirmed occurrences). */
  month: MonthPaymentSummary;
  /** Short month name for the footer, e.g. "ต.ค.". */
  monthLabel: string;
  today: string;
  locale: "th" | "en";
  currencyCode?: string;
  labels: Dictionary["paymentCalendar"];
}

function money(cents: number, currencyCode?: string) {
  return formatMoney(cents, currencyCode, undefined, cents % 100 === 0 ? 0 : 2);
}

/** Home's "Up next" — the money-out counterpart of "money expected". Whole card links to the recurring tab. */
export function UpNextPaymentsCard({ next, month, monthLabel, today, locale, currencyCode, labels }: UpNextPaymentsCardProps) {
  const dayLabels = { today: labels.today, tomorrow: labels.tomorrow, inDays: labels.inDays, overdueDays: labels.overdueDays };

  if (next.length === 0) {
    return (
      <Link href="/money/recurring" aria-label={labels.emptyAria} className={cn(CARD, "px-4 py-3.5")}>
        <Header labels={labels} />
        <p className="mt-2 text-[13.5px] leading-snug font-semibold">{labels.emptyTitle}</p>
        <p className="mt-0.5 text-[12px] leading-[18px] text-muted-foreground">{labels.emptyHint}</p>
        <p className="mt-2 inline-flex items-center gap-1 text-[12.5px] leading-[18px] font-medium text-primary dark:text-[#8fd9b4]">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {labels.emptyCta}
        </p>
      </Link>
    );
  }

  const [first, ...rest] = next;
  const firstDays = daysBetween(today, first.date);
  const firstWhen = relativeDayLabel(firstDays, dayLabels);
  const Icon = KIND_ICON[first.kind];
  const [leftBefore, leftAfter = ""] = labels.leftToPay.split("{amount}");
  const percent = month.totalCents > 0 ? Math.round((month.paidCents / month.totalCents) * 100) : 0;

  return (
    <Link
      href="/money/recurring"
      aria-label={labels.upNextAria
        .replace("{name}", first.label)
        .replace("{amount}", money(first.amountCents, currencyCode))
        .replace("{when}", firstWhen)}
      className={cn(CARD, "px-4 pt-3.5 pb-3")}
    >
      <Header labels={labels} withCue />

      <div className="mt-2.5 flex items-center gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", KIND_TILE[first.kind])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-[22px] font-semibold">{first.label}</p>
          <p className="truncate text-xs leading-[18px] text-muted-foreground">
            {formatShortDueDate(first.date, locale)} · {labels.kinds[first.kind]}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg leading-6 font-bold tabular-nums">{money(first.amountCents, currencyCode)}</p>
          <span
            className={cn(
              "mt-0.5 inline-flex h-5 items-center rounded-full px-2 text-[11px] leading-none font-medium whitespace-nowrap",
              firstDays <= 0
                ? "bg-[#f6e3dc] text-[#9b4538] dark:bg-[#e0907f]/15 dark:text-[#f0b3a6]"
                : "bg-[#f8ebd2] text-[#8a5c1f] dark:bg-[#a9732c]/20 dark:text-[#e8c48c]"
            )}
          >
            {firstWhen}
          </span>
        </div>
      </div>

      {rest.length > 0 ? (
        <ul className="mt-2.5 border-t border-dashed pt-1.5">
          {rest.map((o) => (
            <li key={o.key} className="flex items-center justify-between gap-3 py-1 text-[12.5px] leading-[18px]">
              <span className="min-w-0 truncate text-muted-foreground">
                <span className="font-medium text-foreground">{o.label}</span> · {formatShortDueDate(o.date, locale)} ·{" "}
                {relativeDayLabel(daysBetween(today, o.date), dayLabels)}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{money(o.amountCents, currencyCode)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {month.totalCents > 0 ? (
        <div className="mt-2 border-t pt-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12px] leading-[18px] text-muted-foreground">
            <span>
              {labels.monthFooter.replace("{month}", monthLabel)}{" "}
              <span className="font-semibold text-foreground tabular-nums">{money(month.totalCents, currencyCode)}</span>
            </span>
            <span className="tabular-nums">
              {month.leftCount === 0 ? (
                labels.allPaid
              ) : (
                <>
                  {leftBefore}
                  <span className="font-semibold text-foreground">{money(month.leftCents, currencyCode)}</span>
                  {leftAfter}
                  {" · "}
                  {labels.itemsCount.replace("{n}", String(month.leftCount))}
                </>
              )}
            </span>
          </div>
          <div
            role="img"
            aria-label={labels.paidPercentSr.replace("{percent}", String(percent))}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted dark:bg-white/10"
          >
            <span className="block h-full rounded-full bg-[#5fb592] dark:bg-[#5fae8c]" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : null}
    </Link>
  );
}

function Header({ labels, withCue = false }: { labels: Dictionary["paymentCalendar"]; withCue?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="inline-flex min-w-0 items-center gap-1.5 text-[13px] leading-5 font-medium text-muted-foreground">
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{labels.upNext}</span>
      </h3>
      {withCue ? (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center text-[13px] leading-5 font-medium text-primary dark:text-[#8fd9b4]">
          {labels.viewCalendar}
          <ChevronRight className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  );
}
