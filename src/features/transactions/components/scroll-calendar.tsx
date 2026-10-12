"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { ScrollWeek } from "@/lib/financial/week-strip";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

const WEEK_H = 56;
const STORAGE_KEY = "wos.scrollCalendarWeeks";

/**
 * The scroll calendar (2026-10-12, mockup 3 "คัมภีร์"): a parchment scroll
 * between a wooden rod and a roller with a tassel. Pulling the roller down
 * unrolls earlier weeks below this one (newest on top, like a feed), snapping
 * to 1–4 weeks; pushing it up rolls them away, a tap unrolls one more. Each
 * day shows its net (green above zero, red below) and each week its total.
 * Tapping a day filters the list to it (from = to = that date), tapping it
 * again clears it; ‹ › move the whole scroll 7 days (?week=). How many weeks
 * are open is remembered per device.
 */
export function ScrollCalendar({
  weeks,
  prevWeek,
  nextWeek,
  selectedDate,
}: {
  /** Newest first; weeks[0] ends at the latest day shown. */
  weeks: ScrollWeek[];
  prevWeek: string;
  /** null when the scroll already ends today. */
  nextWeek: string | null;
  selectedDate: string | null;
}) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const max = weeks.length;

  const [open, setOpen] = useState(1);
  const sheetRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const rollerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef(64);
  const drag = useRef<{ y0: number; h0: number; lastY: number; lastT: number; vel: number; moved: boolean } | null>(null);

  const setHeight = useCallback((h: number) => {
    if (sheetRef.current) sheetRef.current.style.height = `${h}px`;
    // The paper's stripes on the roller slide as it "turns".
    rollerRef.current?.style.setProperty("--scroll-turn", `${(h * 1.6).toFixed(1)}px`);
  }, []);
  const heightFor = useCallback((n: number) => baseRef.current + n * WEEK_H, []);

  // Restore the remembered number of open weeks.
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a per-device preference after hydration
      if (saved >= 1) setOpen(Math.min(max, saved));
    } catch {
      // storage unavailable: start rolled up
    }
  }, [max]);

  // Measure the title + weekday header, then size the sheet for `open` weeks.
  useLayoutEffect(() => {
    if (headRef.current) baseRef.current = headRef.current.offsetHeight;
    setHeight(heightFor(open));
  }, [open, heightFor, setHeight, weeks]);

  function commit(n: number) {
    const next = Math.min(max, Math.max(1, n));
    setOpen(next);
    setHeight(heightFor(next));
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // not remembered — fine
    }
    const roller = rollerRef.current;
    if (roller) {
      roller.classList.remove("scroll-swing");
      void roller.offsetWidth; // restart the tassel swing
      roller.classList.add("scroll-swing");
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, h0: heightFor(open), lastY: e.clientY, lastT: performance.now(), vel: 0, moved: false };
    sheetRef.current?.classList.add("scroll-dragging");
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 4) d.moved = true;
    const now = performance.now();
    d.vel = (e.clientY - d.lastY) / Math.max(1, now - d.lastT);
    d.lastY = e.clientY;
    d.lastT = now;
    const min = heightFor(1);
    const top = heightFor(max);
    let h = d.h0 + dy;
    if (h < min) h = min - (min - h) * 0.25; // rubber band past either end
    if (h > top) h = top + (h - top) * 0.25;
    setHeight(h);
  }
  function onPointerEnd() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    sheetRef.current?.classList.remove("scroll-dragging");
    if (!d.moved) {
      commit(open === max ? 1 : open + 1);
      return;
    }
    const h = parseFloat(sheetRef.current?.style.height ?? "0");
    // A flick carries one more week — but not if the finger stopped first.
    const vel = performance.now() - d.lastT > 80 ? 0 : d.vel;
    commit(Math.round((h - baseRef.current) / WEEK_H + vel * 1.2));
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
  const net = (cents: number) => {
    const formatted = new Intl.NumberFormat(dateLocale, { maximumFractionDigits: 0 }).format(Math.abs(Math.round(cents / 100)));
    return cents > 0 ? `+${formatted}` : cents < 0 ? `-${formatted}` : formatted;
  };
  const tone = (cents: number) => (cents > 0 ? "scroll-pos" : cents < 0 ? "scroll-neg" : "");

  const newest = weeks[0].days;
  const oldestShown = weeks[open - 1].days[0].date;
  const title = label(newest[6].date, { month: "long", year: "numeric" });
  const range = `${label(oldestShown, { day: "numeric", month: "short" })} – ${label(newest[6].date, { day: "numeric", month: "short" })}`;
  const endsToday = nextWeek === null;
  const weekName = (w: number) =>
    !endsToday
      ? label(weeks[w].days[0].date, { day: "numeric", month: "short" })
      : w === 0
        ? t("transactions.week.thisWeek")
        : w === 1
          ? t("transactions.week.lastWeek")
          : t("transactions.week.weeksAgo").replace("{n}", String(w));

  return (
    <section aria-label={t("transactions.week.label")} className={cn("scroll-cal transition-opacity", pending && "opacity-60")}>
      <div className="scroll-rod" aria-hidden="true" />
      <div ref={sheetRef} className="scroll-sheet">
        <div ref={headRef} className="px-2 pt-2">
          <div className="scroll-title flex items-center gap-1 px-1 pb-1">
            <span className="text-[15px] font-bold">{title}</span>
            <span className="scroll-muted ml-auto text-[11px] tabular-nums">{range}</span>
            <button
              type="button"
              onClick={() => moveWeek(prevWeek)}
              aria-label={t("transactions.week.previous")}
              className="scroll-muted flex size-7 items-center justify-center rounded-full hover:bg-black/5"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => moveWeek(nextWeek)}
              disabled={nextWeek === null}
              aria-label={t("transactions.week.next")}
              className="scroll-muted flex size-7 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-30"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="scroll-grid scroll-muted pt-1 pb-0.5 text-center text-[10.5px]" aria-hidden="true">
            <span />
            {newest.map((day) => (
              <span key={day.date}>{label(day.date, { weekday: "narrow" })}</span>
            ))}
          </div>
        </div>

        <div className="px-2">
          {weeks.map((week, w) => (
            <div
              key={week.days[0].date}
              // Weeks still rolled up can't be focused or read out.
              inert={w >= open}
              className="scroll-grid scroll-week items-center"
              style={{ height: WEEK_H }}
            >
              <div className="scroll-muted text-[10.5px] leading-tight">
                {weekName(w)}
                <b className={cn("block text-[11.5px] font-semibold tabular-nums", tone(week.netCents) || "scroll-ink")}>
                  {net(week.netCents)}
                </b>
              </div>
              {week.days.map((day) => {
                const selected = selectedDate === day.date;
                const firstOfMonth = day.date.endsWith("-01");
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => pickDay(day.date)}
                    disabled={day.isFuture}
                    aria-pressed={selected}
                    aria-label={`${label(day.date, { weekday: "long", day: "numeric", month: "long" })} · ${net(day.netCents)}${day.hasPending ? ` · ${t("transactions.week.hasPending")}` : ""}`}
                    className={cn(
                      "scroll-day relative flex flex-col items-center gap-0.5 rounded-[10px] py-1.5 tabular-nums disabled:opacity-35",
                      selected && "scroll-day-selected",
                      day.isToday && !selected && "scroll-day-today"
                    )}
                  >
                    <span className="text-[15.5px] leading-none font-semibold">
                      {label(day.date, { day: "numeric" })}
                      {firstOfMonth ? (
                        <span className="scroll-muted ml-px text-[8.5px] font-medium">{label(day.date, { month: "short" })}</span>
                      ) : null}
                    </span>
                    <span className={cn("text-[9.5px]", selected ? "" : tone(day.netCents) || "scroll-muted")}>
                      {day.isFuture ? "·" : net(day.netCents)}
                    </span>
                    {day.hasPending ? (
                      <span aria-hidden="true" className="absolute top-0.5 right-1 size-1.5 rounded-full bg-amber-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={rollerRef}
        className="scroll-roller"
        role="slider"
        tabIndex={0}
        aria-label={t("transactions.week.pull")}
        aria-valuemin={1}
        aria-valuemax={max}
        aria-valuenow={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            commit(open + 1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            commit(open - 1);
          }
        }}
      >
        <span className="scroll-tassel" aria-hidden="true">
          <span className="scroll-cord" />
          <span className="scroll-knot" />
          <span className="scroll-fringe" />
        </span>
      </div>
    </section>
  );
}
