"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { WeekStripDay } from "@/lib/financial/week-strip";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

/**
 * 7-day strip (2026-10-11, mockup "B + D"), today at the right end: each day's net
 * (income − spending, signed; green above zero, red below — 2026-10-12),
 * a gold dot where something still needs review. Tapping a day shows only
 * that day (the existing from/to filters, from = to = that date); tapping
 * it again clears it. ‹ › move 7 days at a time (?week=).
 */
export function WeekStrip({
  days,
  prevWeek,
  nextWeek,
  selectedDate,
}: {
  days: WeekStripDay[];
  prevWeek: string;
  /** null when this is already the current week. */
  nextWeek: string | null;
  selectedDate: string | null;
}) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const dateLocale = locale === "th" ? "th-TH" : "en-US";

  function go(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    startTransition(() => router.push(`/money/transactions?${params.toString()}`, { scroll: false }));
  }

  function pickDay(date: string) {
    go((params) => {
      if (selectedDate === date) {
        params.delete("from");
        params.delete("to");
      } else {
        params.set("from", date);
        params.set("to", date);
      }
    });
  }

  function moveWeek(week: string | null) {
    go((params) => {
      params.delete("from");
      params.delete("to");
      if (week) params.set("week", week);
      else params.delete("week");
    });
  }

  const label = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(dateLocale, { timeZone: "UTC", ...options }).format(new Date(`${date}T00:00:00Z`));
  const range = `${label(days[0].date, { day: "numeric" })}–${label(days[6].date, { day: "numeric", month: "short" })}`;
  // Each day shows its net (income − spending), signed: "+1,157" / "-843" / "0".
  const net = (cents: number) => {
    const formatted = new Intl.NumberFormat(dateLocale, { maximumFractionDigits: 0 }).format(Math.abs(Math.round(cents / 100)));
    return cents > 0 ? `+${formatted}` : cents < 0 ? `-${formatted}` : formatted;
  };

  return (
    <section aria-label={t("transactions.week.label")} className={cn("space-y-1.5 transition-opacity", pending && "opacity-60")}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="font-medium">{range}</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => moveWeek(prevWeek)}
            aria-label={t("transactions.week.previous")}
            className="flex size-7 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => moveWeek(nextWeek)}
            disabled={nextWeek === null}
            aria-label={t("transactions.week.next")}
            className="flex size-7 items-center justify-center rounded-full hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 rounded-2xl border bg-card p-1.5 shadow-card">
        {days.map((day) => {
          const selected = selectedDate === day.date;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => pickDay(day.date)}
              disabled={day.isFuture}
              aria-pressed={selected}
              aria-label={`${label(day.date, { weekday: "long", day: "numeric", month: "long" })} · ${net(day.netCents)}${day.hasPending ? ` · ${t("transactions.week.hasPending")}` : ""}`}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] text-muted-foreground transition-colors disabled:opacity-35",
                selected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                day.isToday && !selected && "ring-1 ring-primary/60 ring-inset"
              )}
            >
              <span>{label(day.date, { weekday: "narrow" })}</span>
              <span className={cn("text-base leading-none font-semibold", selected ? "text-primary-foreground" : "text-foreground")}>
                {label(day.date, { day: "numeric" })}
              </span>
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  selected
                    ? "text-primary-foreground/90"
                    : day.netCents > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : day.netCents < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : ""
                )}
              >
                {day.isFuture ? "·" : net(day.netCents)}
              </span>
              {day.hasPending ? (
                <span aria-hidden="true" className="absolute top-1 right-1.5 size-1.5 rounded-full bg-amber-500" />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
