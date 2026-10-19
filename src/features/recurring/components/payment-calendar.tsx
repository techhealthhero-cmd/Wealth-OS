"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";
import {
  buildMonthPayments,
  daysBetween,
  monthGrid,
  monthOf,
  shiftMonth,
  summarizeMonthPayments,
  type PaymentOccurrence,
  type PaymentSource,
} from "@/lib/financial/payment-calendar";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import { KIND_DOT, formatShortDueDate, formatShortWeekday, formatYearNumber, intlLocale, relativeDayLabel } from "@/features/recurring/lib/payment-display";

export type PaymentCalendarLabels = Dictionary["paymentCalendar"];

export interface PaymentCalendarProps {
  sources: PaymentSource[];
  /** "YYYY-MM-DD" in the user's time zone. */
  today: string;
  locale: "th" | "en";
  currencyCode?: string;
  /** Earliest month the user can navigate back to ("YYYY-MM") — the loaded paid-history window. */
  minMonth?: string;
  labels: PaymentCalendarLabels;
}

const CARD = "rounded-[20px] border bg-card text-card-foreground shadow-card";
const MAX_DOTS = 3;
/** A known Sunday, used only to generate localized weekday headers. */
const SUNDAY = Date.UTC(2026, 9, 18);

function money(cents: number, currencyCode?: string) {
  return formatMoney(cents, currencyCode, undefined, cents % 100 === 0 ? 0 : 2);
}

/**
 * Money › Recurring: month calendar with due-date dots, a selected-day strip,
 * and the month total card. Pure presentation over `PaymentSource[]` — all
 * date projection is in `@/lib/financial/payment-calendar`.
 */
export function PaymentCalendar({ sources, today, locale, currencyCode, minMonth, labels }: PaymentCalendarProps) {
  const thisMonth = monthOf(today);
  const [month, setMonth] = useState(thisMonth);
  const [selected, setSelected] = useState(today);

  const occurrences = useMemo(() => buildMonthPayments(sources, month), [sources, month]);
  const summary = useMemo(() => summarizeMonthPayments(occurrences), [occurrences]);
  const byDate = useMemo(() => {
    const map = new Map<string, PaymentOccurrence[]>();
    for (const o of occurrences) map.set(o.date, [...(map.get(o.date) ?? []), o]);
    return map;
  }, [occurrences]);

  const fmt = intlLocale(locale);
  const [y, m] = month.split("-").map(Number);
  const monthDate = new Date(Date.UTC(y, m - 1, 1));
  const monthName = new Intl.DateTimeFormat(fmt, { month: "long", timeZone: "UTC" }).format(monthDate);
  const monthShort = new Intl.DateTimeFormat(fmt, { month: "short", timeZone: "UTC" }).format(monthDate);
  const yearLabel = formatYearNumber(`${month}-01`, locale);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(fmt, { weekday: locale === "th" ? "narrow" : "short", timeZone: "UTC" }).format(
      new Date(SUNDAY + i * 86_400_000)
    )
  );

  const atMin = minMonth !== undefined && month <= minMonth;

  function goMonth(delta: number) {
    const next = shiftMonth(month, delta);
    if (minMonth !== undefined && next < minMonth) return;
    setMonth(next);
    setSelected(next === thisMonth ? today : `${next}-01`);
  }

  const kindsPresent = new Set(occurrences.map((o) => o.kind));
  const anyPaid = occurrences.some((o) => o.paid);
  const selectedItems = byDate.get(selected) ?? [];
  const selectedDiff = daysBetween(today, selected);
  const selectedDay = Number(selected.slice(8, 10));
  const dayLabels = {
    today: labels.today,
    tomorrow: labels.tomorrow,
    inDays: labels.inDays,
    overdueDays: labels.overdueDays,
  };

  return (
    <div className="space-y-4">
      <section aria-label={labels.calendarLabel} className={cn(CARD, "p-3.5")}>
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="min-w-0 truncate text-[17px] leading-[26px] font-semibold" aria-live="polite">
            {monthName}
            <span className="ml-1.5 text-[13px] font-medium text-muted-foreground">{yearLabel}</span>
          </h2>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              disabled={atMin}
              aria-label={labels.prevMonth}
              className="grid h-9 w-9 place-items-center rounded-full border text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => goMonth(1)}
              aria-label={labels.nextMonth}
              className="grid h-9 w-9 place-items-center rounded-full border text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div aria-hidden="true" className="mt-2.5 grid grid-cols-7 border-b border-dashed pb-1.5">
          {weekdays.map((w, i) => (
            <span key={i} className="text-center text-[11.5px] leading-[18px] font-medium text-muted-foreground/80">
              {w}
            </span>
          ))}
        </div>

        <div className="mt-1.5 grid grid-cols-7 gap-y-0.5">
          {monthGrid(month).map((cell) => {
            if (!cell.inMonth) {
              return (
                <span
                  key={cell.date}
                  aria-hidden="true"
                  className="flex h-[46px] flex-col items-center pt-[5px] text-sm tabular-nums text-muted-foreground/40"
                >
                  <span className="grid h-7 w-7 place-items-center">{cell.day}</span>
                </span>
              );
            }
            const items = byDate.get(cell.date) ?? [];
            const isToday = cell.date === today;
            const isSelected = cell.date === selected;
            const isPast = cell.date < today;
            const dateText = formatShortDueDate(cell.date, locale);
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelected(cell.date)}
                aria-pressed={isSelected}
                aria-label={
                  items.length > 0 ? labels.dayHasPayments.replace("{date}", dateText).replace("{n}", String(items.length)) : dateText
                }
                className="flex h-[46px] flex-col items-center rounded-xl pt-[5px] text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full leading-none",
                    isPast && !isToday && "text-muted-foreground",
                    isToday && "bg-primary font-bold text-primary-foreground ring-2 ring-[#b99a65] ring-offset-2 ring-offset-card",
                    isSelected && !isToday && "bg-[#e9cf7a]/55 font-semibold text-foreground dark:bg-[#e9cf7a]/20"
                  )}
                >
                  {cell.day}
                </span>
                <span aria-hidden="true" className="mt-1 flex h-[7px] gap-[3px]">
                  {items.slice(0, MAX_DOTS).map((o) => (
                    <span key={o.key} className={cn("h-[7px] w-[7px] rounded-full", KIND_DOT[o.kind], o.paid && "opacity-40")} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div
          aria-live="polite"
          className="mx-0.5 mt-2.5 flex items-start gap-2.5 rounded-[14px] bg-[#e9cf7a]/45 px-3 py-2.5 dark:bg-[#e9cf7a]/12"
        >
          <p className="w-11 shrink-0 text-center text-xs leading-4 font-semibold text-primary dark:text-[#8fd9b4]">
            {selectedDiff === 0
              ? labels.today
              : formatShortWeekday(selected, locale)}
            <span className="block text-lg leading-[22px] tabular-nums">{selectedDay}</span>
          </p>
          {selectedItems.length === 0 ? (
            <p className="min-w-0 flex-1 self-center text-[13px] leading-5 text-[#5d5233] dark:text-muted-foreground">
              {labels.nothingDue}
            </p>
          ) : (
            <ul className="min-w-0 flex-1 space-y-1.5" aria-label={labels.dayPayments.replace("{date}", formatShortDueDate(selected, locale))}>
              {selectedItems.map((o) => (
                <li key={o.key} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm leading-5 font-semibold", o.paid && "text-muted-foreground")}>{o.label}</p>
                    <p className="truncate text-xs leading-[18px] text-[#5d5233] dark:text-muted-foreground">
                      {o.paid
                        ? labels.paid
                        : selectedDiff === 0
                          ? labels.dueToday
                          : relativeDayLabel(selectedDiff, dayLabels)}{" "}
                      · {labels.kinds[o.kind]}
                    </p>
                  </div>
                  <p className={cn("shrink-0 text-[15px] leading-5 font-bold tabular-nums", o.paid && "text-muted-foreground")}>
                    {money(o.amountCents, currencyCode)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {kindsPresent.size > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1.5 border-t border-dashed px-1.5 pt-2.5">
            {(["expense", "transfer", "liability"] as const)
              .filter((k) => kindsPresent.has(k))
              .map((k) => (
                <li key={k} className="inline-flex items-center gap-1.5 text-xs leading-[18px] whitespace-nowrap text-muted-foreground">
                  <span aria-hidden="true" className={cn("h-[7px] w-[7px] rounded-full", KIND_DOT[k])} />
                  {labels.kinds[k]}
                </li>
              ))}
            {anyPaid ? (
              <li className="inline-flex items-center gap-1.5 text-xs leading-[18px] whitespace-nowrap text-muted-foreground">
                <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-muted-foreground/35" />
                {labels.paidFaded}
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>

      <MonthTotalCard
        summary={summary}
        title={month === thisMonth ? labels.monthTotalThis : labels.monthTotalOther.replace("{month}", monthShort)}
        currencyCode={currencyCode}
        labels={labels}
      />
    </div>
  );
}

function MonthTotalCard({
  summary,
  title,
  currencyCode,
  labels,
}: {
  summary: ReturnType<typeof summarizeMonthPayments>;
  title: string;
  currencyCode?: string;
  labels: PaymentCalendarLabels;
}) {
  const { totalCents, paidCents, leftCents, leftCount, byKind } = summary;
  const percent = totalCents > 0 ? Math.round((paidCents / totalCents) * 100) : 0;
  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <section aria-label={title} className={cn(CARD, "pb-3")}>
      <div className="flex items-center gap-3.5 px-[18px] pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] leading-5 font-medium text-muted-foreground">{title}</h2>
          <p className="text-[28px] leading-9 font-bold tracking-tight tabular-nums [overflow-wrap:anywhere]">
            {money(totalCents, currencyCode)}
          </p>
          {totalCents === 0 ? (
            <p className="text-[12.5px] leading-[18px] text-muted-foreground">{labels.noneThisMonth}</p>
          ) : (
            <p className="text-[12.5px] leading-[18px] text-muted-foreground">
              {labels.paidAmount.replace("{amount}", money(paidCents, currencyCode))}
              {" · "}
              {leftCount === 0 ? (
                <span className="font-semibold text-foreground">{labels.allPaid}</span>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{labels.leftAmount.replace("{amount}", money(leftCents, currencyCode))}</span>{" "}
                  {labels.inItems.replace("{n}", String(leftCount))}
                </>
              )}
            </p>
          )}
        </div>
        {totalCents > 0 ? (
          <div role="img" aria-label={labels.paidPercentSr.replace("{percent}", String(percent))} className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
              <circle cx="32" cy="32" r={R} fill="none" strokeWidth="7" className="stroke-muted" />
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${(C * percent) / 100} ${C}`}
                className={cn("stroke-primary dark:stroke-[#5fae8c]", percent === 0 && "hidden")}
              />
            </svg>
            <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-center text-xs leading-tight font-semibold text-primary dark:text-[#8fd9b4]">
              <span>
                {percent}%
                <span className="block text-[10px] font-medium text-muted-foreground">{labels.paid}</span>
              </span>
            </span>
          </div>
        ) : null}
      </div>
      {totalCents > 0 ? (
        <div
          role="img"
          aria-label={`${labels.byKindSr}: ${byKind.map((k) => `${labels.kinds[k.kind]} ${money(k.cents, currencyCode)}`).join(", ")}`}
          className="mx-[18px] flex h-2 gap-0.5 overflow-hidden rounded"
        >
          {byKind.map((k) => (
            <span key={k.kind} className={cn("h-full", KIND_DOT[k.kind])} style={{ width: `${(k.cents / totalCents) * 100}%` }} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
