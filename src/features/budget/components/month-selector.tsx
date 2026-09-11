"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { toLocalDateString } from "@/lib/date";

interface MonthSelectorProps {
  /** YYYY-MM-01 */
  month: string;
}

export function MonthSelector({ month }: MonthSelectorProps) {
  const { t, locale } = useTranslation();
  const current = new Date(`${month}T00:00:00`);

  const prev = new Date(current.getFullYear(), current.getMonth() - 1, 1);
  const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  const toKey = toLocalDateString;

  const label = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(current);

  return (
    <div className="flex items-center justify-center gap-3">
      <Link
        href={`/money/budget?month=${toKey(prev)}`}
        aria-label={t("budget.previousMonth")}
        className="rounded-full p-1.5 hover:bg-muted"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Link>
      <span className="min-w-[8rem] text-center text-sm font-medium">{label}</span>
      <Link
        href={`/money/budget?month=${toKey(next)}`}
        aria-label={t("budget.nextMonth")}
        className="rounded-full p-1.5 hover:bg-muted"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
