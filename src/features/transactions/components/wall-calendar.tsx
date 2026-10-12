"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import type { MonthGrid } from "@/lib/financial/week-strip";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

const ROW_H = 56;
const STORAGE_KEY = "wos.wallCalendarStop";

/**
 * The wall calendar (2026-10-12, mockup 2 "ปฏิทินแขวนผนัง"): a real calendar
 * month, Monday first, hanging from rings. Folded it shows one week — this
 * week, or a past month's last; pulling the ribbon tab down opens it to 2, 3
 * weeks and then the whole month. It grows upward from the focused week
 * first (earlier weeks), and only past the month's first row downward. A tap
 * on the ribbon opens one more step (from the whole month it folds back).
 * Each day shows its net (green above zero, red below) and a heat mark —
 * the redder, the more spent. Tapping a day filters the list to it (from =
 * to = that date), tapping it again clears it; ‹ › move a month (?month=).
 * How far it is open is remembered per device.
 */
export function WallCalendar({
  grid,
  prevMonth,
  nextMonth,
  selectedDate,
}: {
  grid: MonthGrid;
  prevMonth: string;
  /** null when this is already the current month. */
  nextMonth: string | null;
  selectedDate: string | null;
}) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const rows = grid.weeks.length;
  const stops = [1, 2, 3, rows];
  const last = stops.length - 1;
  const focusBottom = (grid.focusRow + 1) * ROW_H;

  const [stop, setStop] = useState(0);
  const rowsRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; h0: number; lastY: number; lastT: number; vel: number; moved: boolean } | null>(null);

  // A window over the month's rows that grows upward from the focused week.
  const setHeight = useCallback(
    (h: number) => {
      if (rowsRef.current) rowsRef.current.style.height = `${h}px`;
      const top = h <= focusBottom ? focusBottom - h : 0;
      if (innerRef.current) innerRef.current.style.transform = `translateY(${-top}px)`;
    },
    [focusBottom]
  );

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a per-device preference after hydration
      if (saved > 0) setStop(Math.min(last, saved));
    } catch {
      // storage unavailable: start folded
    }
  }, [last]);

  useLayoutEffect(() => {
    setHeight(stops[stop] * ROW_H);
    // stops[stop] is derived from `stop` and `rows`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, rows, setHeight]);

  function commit(next: number) {
    const s = Math.min(last, Math.max(0, next));
    setStop(s);
    setHeight(stops[s] * ROW_H);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(s));
    } catch {
      // not remembered — fine
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, h0: stops[stop] * ROW_H, lastY: e.clientY, lastT: performance.now(), vel: 0, moved: false };
    rowsRef.current?.classList.add("wall-dragging");
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 4) d.moved = true;
    const now = performance.now();
    d.vel = (e.clientY - d.lastY) / Math.max(1, now - d.lastT);
    d.lastY = e.clientY;
    d.lastT = now;
    const min = ROW_H;
    const max = rows * ROW_H;
    let h = d.h0 + dy;
    if (h < min) h = min - (min - h) * 0.25; // rubber band past either end
    if (h > max) h = max + (h - max) * 0.25;
    setHeight(h);
  }
  function onPointerEnd() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    rowsRef.current?.classList.remove("wall-dragging");
    if (!d.moved) {
      commit(stop === last ? 0 : stop + 1);
      return;
    }
    const h = parseFloat(rowsRef.current?.style.height ?? "0");
    // A flick carries one more step — but not if the finger stopped first.
    const vel = performance.now() - d.lastT > 80 ? 0 : d.vel;
    const want = h / ROW_H + vel * 1.2;
    let best = 0;
    stops.forEach((n, i) => {
      if (Math.abs(n - want) < Math.abs(stops[best] - want)) best = i;
    });
    commit(best);
  }

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
  function moveMonth(month: string | null) {
    go((params) => {
      params.delete("from");
      params.delete("to");
      if (month) params.set("month", month);
      else params.delete("month");
    });
  }

  const label = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(dateLocale, { timeZone: "UTC", ...options }).format(new Date(`${date}T00:00:00Z`));
  const net = (cents: number) => {
    const baht = Math.abs(Math.round(cents / 100));
    const formatted = new Intl.NumberFormat(dateLocale, {
      maximumFractionDigits: baht >= 100_000 ? 1 : 0,
      notation: baht >= 100_000 ? "compact" : "standard",
    }).format(baht);
    return cents > 0 ? `+${formatted}` : cents < 0 ? `-${formatted}` : formatted;
  };
  const tone = (cents: number) => (cents > 0 ? "wall-pos" : cents < 0 ? "wall-neg" : "");

  const isCurrentMonth = nextMonth === null;
  const title = label(`${grid.month}-01`, { month: "long", year: "numeric" });
  const shown = stops[stop];
  const firstShown = shown * ROW_H <= focusBottom ? grid.focusRow + 1 - shown : 0;
  const full = stop === last;

  return (
    <section aria-label={t("transactions.week.label")} className={cn("wall-cal transition-opacity", pending && "opacity-60")}>
      <div className="wall-card">
        <div className="wall-rings" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="flex items-center gap-1 px-1.5 pb-1">
          <span className="text-[16px] font-bold">{title}</span>
          <span className="wall-muted ml-auto text-[12px] tabular-nums">
            {isCurrentMonth ? t("transactions.week.monthNet") : t("transactions.week.wholeMonthNet")}{" "}
            <b className={cn("font-semibold", tone(grid.netCents))}>{net(grid.netCents)}</b>
          </span>
          <button
            type="button"
            onClick={() => moveMonth(prevMonth)}
            aria-label={t("transactions.week.previous")}
            className="wall-muted flex size-7 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => moveMonth(nextMonth)}
            disabled={nextMonth === null}
            aria-label={t("transactions.week.next")}
            className="wall-muted flex size-7 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="wall-muted grid grid-cols-7 pb-0.5 text-center text-[11px]" aria-hidden="true">
          {grid.weeks[0].map((day) => (
            <span key={day.date} className={cn(day.index >= 5 && "wall-weekend")}>
              {label(day.date, { weekday: "narrow" })}
            </span>
          ))}
        </div>

        <div ref={rowsRef} className="wall-rows" style={{ height: ROW_H }}>
          <div ref={innerRef} className="wall-inner">
            {grid.weeks.map((week, w) => (
              <div
                key={week[0].date}
                // Folded-away weeks can't be focused or read out.
                inert={w < firstShown || w >= firstShown + shown}
                className={cn("grid grid-cols-7 gap-[3px]", w === grid.focusRow && isCurrentMonth && "wall-row-current")}
                style={{ height: ROW_H }}
              >
                {week.map((day) => {
                  const selected = selectedDate === day.date;
                  const heat =
                    day.isFuture || grid.maxSpentCents === 0
                      ? null
                      : day.netCents > 0
                        ? "var(--wall-pos)"
                        : day.spentCents > 0
                          ? `color-mix(in srgb, var(--wall-neg) ${Math.round(25 + (75 * day.spentCents) / grid.maxSpentCents)}%, transparent)`
                          : null;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => pickDay(day.date)}
                      disabled={day.isFuture}
                      aria-pressed={selected}
                      aria-label={`${label(day.date, { weekday: "long", day: "numeric", month: "long" })}${day.isFuture ? "" : ` · ${net(day.netCents)}`}${day.hasPending ? ` · ${t("transactions.week.hasPending")}` : ""}`}
                      className={cn(
                        "wall-day relative my-[3px] flex flex-col items-center justify-center gap-0.5 rounded-[11px] tabular-nums",
                        !day.inMonth && "wall-day-out",
                        day.isFuture && "wall-day-future",
                        day.isToday && !selected && "wall-day-today",
                        selected && "wall-day-selected"
                      )}
                    >
                      <span className="wall-n text-[16px] leading-none font-semibold">{label(day.date, { day: "numeric" })}</span>
                      <span className={cn("wall-v text-[10px]", tone(day.netCents) || "wall-muted")}>
                        {day.isFuture ? " " : net(day.netCents)}
                      </span>
                      {heat ? (
                        <i aria-hidden="true" className="absolute bottom-[3px] h-[3px] w-[18px] rounded-sm" style={{ background: heat }} />
                      ) : null}
                      {day.hasPending ? (
                        <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-500" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-1 flex justify-center">
        <button
          type="button"
          className="wall-ribbon"
          role="slider"
          aria-label={t("transactions.week.pull")}
          aria-valuemin={1}
          aria-valuemax={stops.length}
          aria-valuenow={stop + 1}
          aria-valuetext={full ? t("transactions.week.wholeMonth") : `${shown} ${t("transactions.week.weeks")}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          // Enter/Space (a click with no pointer): same as a tap.
          onClick={(e) => {
            if (e.detail === 0) commit(stop === last ? 0 : stop + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              commit(stop + 1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              commit(stop - 1);
            }
          }}
        >
          <ChevronDown className={cn("size-3 transition-transform", full && "rotate-180")} aria-hidden="true" />
          {full ? t("transactions.week.fold") : t("transactions.week.openMonth")}
        </button>
      </div>

      <div className="mt-2 flex justify-center gap-1.5 text-[11px]">
        {stops.map((n, i) => (
          <button
            key={i}
            type="button"
            onClick={() => commit(i)}
            aria-pressed={i === stop}
            className={cn("wall-stop rounded-full border px-2 py-0.5", i === stop && "wall-stop-on")}
          >
            {i === last ? t("transactions.week.wholeMonth") : i === 0 ? `1 ${t("transactions.week.weeks")}` : n}
          </button>
        ))}
      </div>

      <div className="wall-muted mt-2 flex flex-wrap gap-3 px-1 text-[11.5px]">
        <span>
          <i className="mr-1 inline-block h-[3px] w-3.5 rounded-sm align-middle" style={{ background: "var(--wall-neg)" }} />
          {t("transactions.week.heatSpend")}
        </span>
        <span>
          <i className="mr-1 inline-block h-[3px] w-3.5 rounded-sm align-middle" style={{ background: "var(--wall-pos)" }} />
          {t("transactions.week.heatIncome")}
        </span>
      </div>
    </section>
  );
}
