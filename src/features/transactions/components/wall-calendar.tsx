"use client";

import type { CSSProperties } from "react";

import type { MoneyCalendarText } from "@/lib/money-calendar-text";
import type { MonthGrid } from "@/lib/financial/week-strip";
import { cn } from "@/lib/utils";
import { dayTone, spendMix } from "../lib/day-heat";
import { useTransactionsQuery } from "./use-transactions-query";

export interface DayCalendarLabels {
  title: string;
  tapDay: string;
  /** Contains {day}. */
  selectedDay: string;
  heatSpend: string;
  heatIncome: string;
  hasPending: string;
  today: string;
}

export interface DayCalendarViewProps {
  grid: MonthGrid;
  text: MoneyCalendarText;
  selectedDate: string | null;
  labels: DayCalendarLabels;
  pending?: boolean;
  onPickDay: (date: string) => void;
}

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

/**
 * The month calendar on Finance → รายการ (Variant B). The whole month is
 * open: each day shows its net, a redder number means more spent, and green
 * means money came in. Tapping a day filters the list to it (from = to =
 * that date); tapping it again clears the day. Today is the cream chip;
 * the chosen day is leather green.
 */
export function DayCalendarView({ grid, text, selectedDate, labels, pending, onPickDay }: DayCalendarViewProps) {
  const weekdays = grid.weeks[0] ?? [];
  const days = grid.weeks.flat();
  // Include later days in the month: a future-dated transaction still belongs
  // on its day, and an empty day reads as 0 rather than a blank cell.
  const maxSpentCents = days.reduce((max, day) => Math.max(max, day.spentCents), 0);
  const selectedDayNumber =
    selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? String(Number(selectedDate.slice(8, 10))) : null;

  return (
    <section
      aria-labelledby="finance-calendar-heading"
      data-testid="finance-calendar"
      className={cn("finance-cal relative transition-opacity", pending && "opacity-60")}
      aria-busy={pending || undefined}
    >
      <div className="pointer-events-none absolute inset-x-8 -top-2 z-10 flex justify-between" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className="h-[18px] w-2 rounded-full bg-gradient-to-r from-[#8d7a58] via-[#e6d3a4] to-[#8d7a58] shadow-[0_1px_1px_rgba(60,40,10,0.25)] dark:from-[#6b6352] dark:via-[#a89878] dark:to-[#6b6352]"
          />
        ))}
      </div>
      <div className="rounded-[22px] border border-[#e6dac2] bg-[#fffbf2] px-2.5 pt-4 pb-2.5 text-[#26332d] shadow-card dark:border-[#343c36] dark:bg-[#232925] dark:text-[#ece6da]">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 id="finance-calendar-heading" className="text-[15px] font-semibold">
            {labels.title}
          </h2>
          <p className="max-w-[58%] text-right text-[11px] leading-4 text-[#8a8174] dark:text-[#a39c8f]">
            {selectedDayNumber ? fill(labels.selectedDay, { day: selectedDayNumber }) : labels.tapDay}
          </p>
        </div>
        <div className="mt-2 grid grid-cols-7 pb-0.5 text-center text-[11px] text-[#8a8174] dark:text-[#a39c8f]" aria-hidden="true">
          {weekdays.map((day) => (
            <span key={day.date}>{text.dates[day.date]?.narrow ?? ""}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const tone = dayTone(day, maxSpentCents);
            const selected = selectedDate === day.date;
            const net = text.nets[String(day.netCents)] ?? "";
            const long = text.dates[day.date]?.long ?? day.date;
            const name = [long, day.isToday ? labels.today : "", net, day.hasPending ? labels.hasPending : ""]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={day.date}
                type="button"
                data-testid={`finance-day-${day.date}`}
                data-tone={tone.kind}
                data-today={day.isToday ? "true" : undefined}
                onClick={() => onPickDay(day.date)}
                aria-pressed={selected}
                aria-label={name}
                style={
                  tone.kind === "spend" && !selected
                    ? ({ "--spend": `${spendMix(tone.ratio)}%` } as CSSProperties)
                    : undefined
                }
                className={cn(
                  "relative my-px flex min-h-11 min-w-0 flex-col items-center justify-center rounded-[12px] px-0.5 py-1 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204d3d] focus-visible:ring-offset-1 focus-visible:ring-offset-[#fffbf2] dark:focus-visible:ring-[#8fc4a8] dark:focus-visible:ring-offset-[#232925]",
                  !day.inMonth && !selected && "opacity-40",
                  tone.kind === "income" && !selected && "text-[#1e7a4a] dark:text-[#8fd0ae]",
                  tone.kind === "empty" && !selected && "text-[#8a8174] dark:text-[#a39c8f]",
                  tone.kind === "spend" && !selected && "finance-day-spend",
                  day.isToday && !selected && "bg-[#efe6d4] dark:bg-white/10",
                  selected && "bg-[#1b4335] text-[#fffbf2] opacity-100 dark:bg-[#8fc4a8] dark:text-[#14201a]",
                )}
              >
                <span className="text-[15px] leading-none font-semibold">{Number(day.date.slice(8, 10))}</span>
                <span className="mt-0.5 max-w-full truncate text-[10px] leading-none font-medium">{net}</span>
                {day.hasPending ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-1 right-1 size-1.5 rounded-full",
                      selected ? "bg-[#f6d27a] dark:bg-[#14201a]" : "bg-amber-500",
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-1 text-[11px] text-[#8a8174] dark:text-[#a39c8f]">
          <span className="inline-flex items-center gap-1.5">
            <i
              aria-hidden="true"
              className="inline-block h-1.5 w-7 rounded-full"
              style={{
                background: `linear-gradient(90deg, color-mix(in srgb, var(--finance-spend) ${spendMix(0)}%, var(--finance-spend-soft)), var(--finance-spend))`,
              }}
            />
            {labels.heatSpend}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="inline-block size-2 rounded-[3px] bg-[#1e7a4a] dark:bg-[#8fd0ae]" />
            {labels.heatIncome}
          </span>
        </div>
      </div>
    </section>
  );
}

export function WallCalendar({
  grid,
  text,
  selectedDate,
  labels,
}: {
  grid: MonthGrid;
  text: MoneyCalendarText;
  selectedDate: string | null;
  labels: DayCalendarLabels;
}) {
  const { pending, push } = useTransactionsQuery();

  function pickDay(date: string) {
    push((params) => {
      if (selectedDate === date) {
        params.delete("from");
        params.delete("to");
      } else {
        params.set("from", date);
        params.set("to", date);
      }
    });
  }

  return (
    <DayCalendarView
      grid={grid}
      text={text}
      selectedDate={selectedDate}
      labels={labels}
      pending={pending}
      onPickDay={pickDay}
    />
  );
}
