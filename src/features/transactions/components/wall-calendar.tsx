"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownRight, ArrowUpLeft, ChevronLeft, ChevronRight } from "lucide-react";

import type { MonthGrid } from "@/lib/financial/week-strip";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

const ROW_H = 56;
const STORAGE_KEY = "wos.wallCalendarWeeks";
/** The dog-eared corner's size, and how much more it lifts while pulled. */
const CURL = 52;
const CURL_LIFT = 22;

/**
 * The wall calendar (2026-10-12, mockup 2 "ปฏิทินแขวนผนัง"): a real calendar
 * month, Monday first, hanging from rings. Folded it shows one week — this
 * week, or a past month's last. Its bottom-right corner is dog-eared
 * (2026-10-13, mockup I "พลิกมุมกระดาษ"): tapping the corner opens one more
 * week, up to the whole month, then folds back to one; dragging it down
 * pulls the calendar open (the corner lifts as you pull) and up pushes it
 * shut, snapping to a whole week. It grows upward from the focused week
 * first (earlier weeks), and only past the month's first row downward.
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
  text,
}: {
  grid: MonthGrid;
  text: import("@/lib/money-calendar-text").MoneyCalendarText;
  prevMonth: string;
  /** null when this is already the current month. */
  nextMonth: string | null;
  selectedDate: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const rows = grid.weeks.length;
  const focusBottom = (grid.focusRow + 1) * ROW_H;

  /** How many weeks are open, 1..rows. */
  const [shown, setShown] = useState(1);
  const paperRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    y0: number;
    h0: number;
    lastY: number;
    lastT: number;
    vel: number;
    moved: boolean;
  } | null>(null);

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
      if (saved > 0) setShown(Math.min(rows, Math.round(saved)));
    } catch {
      // storage unavailable: start folded
    }
  }, [rows]);

  useLayoutEffect(() => {
    setHeight(Math.min(shown, rows) * ROW_H);
  }, [shown, rows, setHeight]);

  function commit(next: number) {
    const n = Math.min(rows, Math.max(1, next));
    setShown(n);
    setHeight(n * ROW_H);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(n));
    } catch {
      // not remembered — fine
    }
  }

  function lift(px: number) {
    paperRef.current?.style.setProperty("--curl", `${CURL + px}px`);
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      y0: e.clientY,
      h0: Math.min(shown, rows) * ROW_H,
      lastY: e.clientY,
      lastT: performance.now(),
      vel: 0,
      moved: false,
    };
    paperRef.current?.classList.add("wall-dragging");
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
    lift(Math.min(CURL_LIFT, Math.abs(dy) * 0.2));
  }
  function onPointerEnd() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    paperRef.current?.classList.remove("wall-dragging");
    lift(0);
    if (!d.moved) {
      // A tap turns one more week; at the whole month it folds back to one.
      commit(shown >= rows ? 1 : shown + 1);
      return;
    }
    const h = parseFloat(rowsRef.current?.style.height ?? "0");
    // A flick carries one more week — but not if the finger stopped first.
    const vel = performance.now() - d.lastT > 80 ? 0 : d.vel;
    commit(Math.round(h / ROW_H + vel * 1.2));
  }

  function go(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    startTransition(() =>
      router.push(`/money/transactions?${params.toString()}`, {
        scroll: false,
      })
    );
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

  const label = (date: string, options: { weekday: "narrow" | "long"; day?: "numeric"; month?: "long" }) => text.dates[date][options.weekday];
  const net = (cents: number) => text.nets[String(cents)];
  const tone = (cents: number) => (cents > 0 ? "wall-pos" : cents < 0 ? "wall-neg" : "");

  const isCurrentMonth = nextMonth === null;
  const title = text.title;
  const open = Math.min(shown, rows);
  const firstShown = open * ROW_H <= focusBottom ? grid.focusRow + 1 - open : 0;
  const full = open >= rows;

  return (
    <section
      aria-label={t("transactions.week.label")}
      className={cn("wall-cal transition-opacity", pending && "opacity-60")}
    >
      <div ref={paperRef} className="wall-paper">
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
                  inert={w < firstShown || w >= firstShown + open}
                  className={cn(
                    "grid grid-cols-7 gap-[3px]",
                    w === grid.focusRow && isCurrentMonth && "wall-row-current"
                  )}
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
                        <span className="wall-n text-[16px] leading-none font-semibold">
                          {Number(day.date.slice(8, 10))}
                        </span>
                        <span className={cn("wall-v text-[10px]", tone(day.netCents) || "wall-muted")}>
                          {day.isFuture ? " " : net(day.netCents)}
                        </span>
                        {heat ? (
                          <i
                            aria-hidden="true"
                            className="absolute bottom-[3px] h-[3px] w-[18px] rounded-sm"
                            style={{ background: heat }}
                          />
                        ) : null}
                        {day.hasPending ? (
                          <span
                            aria-hidden="true"
                            className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-500"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <p className="wall-muted wall-hint text-[11.5px] tabular-nums">
            {full ? t("transactions.week.curlFold") : t("transactions.week.curlHint")} · {open}/{rows}
          </p>
        </div>

        {/* The dog-eared corner (2026-10-13, mockup I): tap to turn one more
          week, or drag it down/up. It sits outside the clipped card so the
          whole corner square stays tappable. */}
        <button
          type="button"
          aria-label={`${full ? t("transactions.week.curlFold") : t("transactions.week.curlHint")} (${open}/${rows})`}
          className="wall-curl"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          // Taps arrive through the pointer handlers; this is Enter/Space.
          onClick={(e) => {
            if (e.detail === 0) commit(full ? 1 : open + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
              e.preventDefault();
              commit(open + 1);
            } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
              e.preventDefault();
              commit(open - 1);
            }
          }}
        >
          <span className="wall-curl-flap" aria-hidden="true">
            {full ? <ArrowUpLeft className="size-4" /> : <ArrowDownRight className="size-4" />}
          </span>
        </button>
      </div>

      <div className="wall-muted mt-1 flex flex-wrap gap-3 px-1 text-[11.5px]">
        <span>
          <i
            className="mr-1 inline-block h-[3px] w-3.5 rounded-sm align-middle"
            style={{ background: "var(--wall-neg)" }}
          />
          {t("transactions.week.heatSpend")}
        </span>
        <span>
          <i
            className="mr-1 inline-block h-[3px] w-3.5 rounded-sm align-middle"
            style={{ background: "var(--wall-pos)" }}
          />
          {t("transactions.week.heatIncome")}
        </span>
      </div>
    </section>
  );
}
