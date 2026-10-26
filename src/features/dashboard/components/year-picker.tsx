"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

/**
 * The yearly card's heading ("ปีนี้ · ม.ค. – ต.ค."). Tapping it opens a grid
 * of year cells, like a calendar's year view (the user asked for cells, not
 * a scroll wheel). Tapping a year shows it at once: the year goes in the URL
 * (?year=2025) so the whole card — totals, monthly bars, categories — is
 * rebuilt for that year on the server, and a refresh keeps it. With only one
 * year of data there is nothing to choose, so the heading stays plain text.
 */
export function YearPicker({
  title,
  years,
  selectedYear,
  currentYear,
}: {
  /** Already-formatted heading for the year shown. */
  title: string;
  /** Selectable years, oldest first. */
  years: number[];
  selectedYear: number;
  currentYear: number;
}) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Thai counts in the Buddhist era (2026 → 2569), like the rest of the app's Thai dates.
  const yearText = (y: number) => String(locale === "th" ? y + 543 : y);

  const heading = <span className="truncate">{title}</span>;
  if (years.length <= 1) {
    return <h2 className="flex min-w-0 text-sm font-semibold text-muted-foreground">{heading}</h2>;
  }

  function show(year: number) {
    setOpen(false);
    if (year === selectedYear) return;
    startTransition(() => {
      router.push(year === currentYear ? "/dashboard" : `/dashboard?year=${year}`, { scroll: false });
    });
  }

  return (
    <div className="min-w-0">
      <h2 className="min-w-0 text-sm font-semibold text-muted-foreground">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${title} · ${t("dashboard.year.pickYear")}`}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "-mx-1.5 -my-1 inline-flex max-w-full items-center gap-1 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selectedYear !== currentYear && "text-foreground"
          )}
        >
          {heading}
          {pending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden="true" />
          )}
        </button>
      </h2>

      {open ? (
        <div className="relative z-10 mt-2 w-64 max-w-[calc(100vw-4rem)] rounded-2xl border bg-card p-3 shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="mb-2 text-xs text-muted-foreground">{t("dashboard.year.pickYearHint")}</p>
          <div role="group" aria-label={t("dashboard.year.pickYear")} className="grid max-h-60 grid-cols-3 gap-2 overflow-y-auto">
            {years.map((y) => {
              const selected = y === selectedYear;
              return (
                <button
                  key={y}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => show(y)}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center rounded-xl border text-base font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  )}
                >
                  {yearText(y)}
                  {y === currentYear ? (
                    <span className={cn("text-[11px] font-medium", selected ? "opacity-90" : "text-muted-foreground")}>
                      {t("dashboard.year.thisYear")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
