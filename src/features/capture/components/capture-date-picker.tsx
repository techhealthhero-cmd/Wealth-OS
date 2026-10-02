"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { isValidCaptureDate, recentCaptureDates } from "@/lib/capture/capture-date";

const ROW = 44;
const VISIBLE = 5;

function shortLabel(iso: string, locale: "th" | "en") {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${iso}T00:00:00`)
  );
}

/**
 * Which day Quick Capture records into. A pill shows the day ("วันนี้" by
 * default, tinted when backdated so it's never a surprise); tapping it
 * opens an iOS-style wheel — swipe DOWN to go back in time — plus the full
 * calendar for anything older than the wheel. Future days can't be picked.
 */
export function CaptureDatePicker({ value, today, onChange }: { value: string; today: string; onChange: (date: string) => void }) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const dates = useMemo(() => recentCaptureDates(today), [today]);
  const yesterday = dates[dates.length - 2];
  const label = (iso: string) =>
    iso === today ? t("capture.today") : iso === yesterday ? t("capture.yesterday") : shortLabel(iso, locale);
  const backdated = value !== today;

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${t("capture.date.label")}: ${label(value)}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          backdated ? "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200" : "bg-background hover:bg-muted"
        )}
      >
        <CalendarDays className="size-4" aria-hidden="true" />
        {label(value)}
        {value === yesterday ? <span className="text-xs opacity-75">{shortLabel(value, locale)}</span> : null}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open ? (
        <div className="rounded-2xl border bg-card p-3 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="mb-2 text-xs text-muted-foreground">{t("capture.date.hint")}</p>
          <DateWheel dates={dates} value={value} label={label} onChange={onChange} />
          <div className="mt-3 flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              {t("capture.date.calendar")}
              <input
                type="date"
                max={today}
                value={value}
                onChange={(e) => {
                  if (isValidCaptureDate(e.target.value, today)) onChange(e.target.value);
                }}
                className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("capture.date.done")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Scroll-snapping wheel: oldest at the top, today at the bottom; the centred row is the choice. */
function DateWheel({
  dates,
  value,
  label,
  onChange,
}: {
  dates: string[];
  value: string;
  label: (iso: string) => string;
  onChange: (date: string) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectedIndex = dates.indexOf(value);
  const pad = ((VISIBLE - 1) / 2) * ROW;

  // Open centred on the current choice (a calendar-picked older day centres "today"'s end).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = (selectedIndex >= 0 ? selectedIndex : dates.length - 1) * ROW;
    // Only on mount: later changes come from the wheel itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  function scrollToIndex(i: number) {
    const clamped = Math.max(0, Math.min(dates.length - 1, i));
    ref.current?.scrollTo({ top: clamped * ROW, behavior: "smooth" });
    onChange(dates[clamped]);
  }

  return (
    <div className="relative" style={{ height: ROW * VISIBLE }}>
      {/* The selection band sits behind the centred row. */}
      <div className="pointer-events-none absolute inset-x-0 rounded-xl bg-muted" style={{ top: pad, height: ROW }} aria-hidden="true" />
      <div
        ref={ref}
        role="listbox"
        aria-label={t("capture.date.label")}
        aria-activedescendant={selectedIndex >= 0 ? `capture-date-${dates[selectedIndex]}` : undefined}
        tabIndex={0}
        // The sheet's pull-to-close must leave this nested scroller alone.
        data-sheet-nodrag=""
        onScroll={(e) => {
          const el = e.currentTarget;
          clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => {
            const i = Math.max(0, Math.min(dates.length - 1, Math.round(el.scrollTop / ROW)));
            if (dates[i] !== value) {
              onChange(dates[i]);
              navigator.vibrate?.(5);
            }
          }, 90);
        }}
        onKeyDown={(e) => {
          const current = selectedIndex >= 0 ? selectedIndex : dates.length - 1;
          if (e.key === "ArrowUp") {
            e.preventDefault();
            scrollToIndex(current - 1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            scrollToIndex(current + 1);
          }
        }}
        className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-scrollbar]:hidden"
        style={{
          paddingTop: pad,
          paddingBottom: pad,
          maskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
        }}
      >
        {dates.map((iso, i) => {
          const selected = iso === value;
          return (
            <div
              key={iso}
              id={`capture-date-${iso}`}
              role="option"
              aria-selected={selected}
              onClick={() => scrollToIndex(i)}
              className={cn(
                "flex snap-center items-center justify-center text-base transition-[color,font-weight] duration-100",
                selected ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
              style={{ height: ROW }}
            >
              {label(iso)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
