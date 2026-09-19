"use client";

import type { AnnualMetric, MoneyYearSummary } from "@/features/money-year/queries";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { Badge } from "@/components/ui/badge";

const STATUS_BADGE_CLASS: Record<string, string> = {
  ahead: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  on_track: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  behind: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const METRIC_KEYS: AnnualMetric["key"][] = ["income", "savings", "investment", "debtReduction", "emergencyFund"];

/**
 * Years as columns, metrics as rows — read left-to-right within a metric's
 * row to see the trend across years, matching how a spreadsheet comparison
 * naturally reads. Wrapped in a horizontally-scrollable container (same
 * pattern as `money-tabs.tsx`) since 5 years x 5 metrics doesn't fit a
 * phone width.
 */
export function MoneyYearCompareView({ summaries }: { summaries: MoneyYearSummary[] }) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="sticky left-0 bg-muted/50 px-3 py-2.5 text-left font-medium">
              {t("moneyYear.compareMetric")}
            </th>
            {summaries.map((s) => (
              <th key={s.moneyYear.year} className="px-3 py-2.5 text-right font-medium">
                {s.moneyYear.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_KEYS.map((key) => (
            <tr key={key} className="border-b last:border-0">
              <td className="sticky left-0 bg-background px-3 py-3 font-medium text-muted-foreground">
                {t(`moneyYear.metrics.${key}`)}
              </td>
              {summaries.map((s) => {
                const metric = s.metrics.find((m) => m.key === key);
                if (!metric) return <td key={s.moneyYear.year} className="px-3 py-3 text-right">—</td>;
                return (
                  <td key={s.moneyYear.year} className="px-3 py-3 text-right">
                    <p className="font-medium">{formatMoney(metric.progress.actualCents)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("moneyYear.target")}: {formatMoney(metric.progress.targetCents)}
                    </p>
                    <Badge className={`mt-1 ${STATUS_BADGE_CLASS[metric.status]}`}>
                      {t(`moneyYear.status.${metric.status}`)}
                    </Badge>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
