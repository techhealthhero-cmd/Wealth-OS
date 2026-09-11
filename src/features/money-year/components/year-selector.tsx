"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useTranslation } from "@/i18n/client";

export function YearSelector({ year }: { year: number }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-3">
      <Link
        href={`/plan/money-year?year=${year - 1}`}
        aria-label={t("moneyYear.previousYear")}
        className="rounded-full p-1.5 hover:bg-muted"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Link>
      <span className="min-w-[4rem] text-center text-sm font-medium">{year}</span>
      <Link
        href={`/plan/money-year?year=${year + 1}`}
        aria-label={t("moneyYear.nextYear")}
        className="rounded-full p-1.5 hover:bg-muted"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
