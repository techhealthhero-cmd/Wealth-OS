"use client";

import { useMemo, useState } from "react";

import { addMonthsClamped, toLocalDateString } from "@/lib/date";
import { formatFriendlyDate } from "@/lib/transaction-ui";
import { useTranslation } from "@/i18n/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PRESET_MONTHS = [3, 6, 12, 24, 60] as const;
const CUSTOM = "__custom__";

function presetDate(months: number): string {
  return toLocalDateString(addMonthsClamped(new Date(), months));
}

function approxMonthsUntil(dateStr: string): number | null {
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const days = (target.getTime() - new Date(new Date().toDateString()).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(days / 30.44));
}

/**
 * Replaces a plain native `<input type="date">` for "when do you want to
 * reach this income target" with quick duration presets (3mo/6mo/1yr/2yr/
 * 5yr) — the same chip-picker pattern `emergency-fund-form.tsx` already
 * established for "how many months of expenses" — plus a small visual
 * timeline bar showing today -> the resulting date, so the horizon is
 * immediately legible rather than requiring the user to do date math in
 * their head. "กำหนดเอง" (custom) still allows picking an exact date for
 * anyone who wants one, via the same native date input as before.
 */
export function TargetDateField({ defaultValue, name }: { defaultValue?: string | null; name: string }) {
  const { t, locale } = useTranslation();

  const initialMode = useMemo(() => {
    if (!defaultValue) return "12";
    const match = PRESET_MONTHS.find((m) => presetDate(m) === defaultValue);
    return match ? String(match) : CUSTOM;
  }, [defaultValue]);

  const [mode, setMode] = useState<string>(initialMode);
  const [customDate, setCustomDate] = useState(defaultValue ?? "");

  const resolvedDate = mode === CUSTOM ? customDate : presetDate(Number(mode));
  const monthsAway = mode === CUSTOM ? approxMonthsUntil(resolvedDate) : Number(mode);

  return (
    <div className="space-y-2">
      <Label>{t("earn.target.targetDate")}</Label>
      <input type="hidden" name={name} value={resolvedDate} />

      <div className="flex flex-wrap gap-2">
        {PRESET_MONTHS.map((months) => (
          <button
            key={months}
            type="button"
            onClick={() => setMode(String(months))}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              mode === String(months)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            )}
          >
            {t(`earn.target.durationPresets.${months}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMode(CUSTOM)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            mode === CUSTOM
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:bg-muted"
          )}
        >
          {t("earn.target.customDate")}
        </button>
      </div>

      {mode === CUSTOM ? (
        <Input
          type="date"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          min={toLocalDateString(new Date())}
          aria-label={t("earn.target.targetDate")}
        />
      ) : null}

      {resolvedDate ? (
        <div className="space-y-1.5 rounded-lg border bg-muted/30 px-3 py-2.5">
          {monthsAway !== null ? (
            <p className="text-sm font-medium">
              {t("earn.target.reachIn").replace("{months}", String(monthsAway))}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">{t("earn.target.today")}</span>
            <div className="relative h-1.5 flex-1 rounded-full bg-primary/20">
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: "100%" }} />
              <div className="absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
            </div>
            <span className="shrink-0 text-xs font-medium">
              {formatFriendlyDate(resolvedDate, locale, {
                today: t("transactions.today"),
                yesterday: t("transactions.yesterday"),
              })}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
