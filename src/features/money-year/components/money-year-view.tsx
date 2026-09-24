"use client";

import { useTransition } from "react";
import { MoreVertical } from "lucide-react";

import type { MoneyYearMajorExpense, QuarterlyPlan } from "@/types/database";
import type { AnnualMetric, QuarterlySummary } from "@/features/money-year/queries";
import { deleteMajorExpense, toggleMajorExpensePaid } from "@/features/money-year/actions";
import { useTranslation } from "@/i18n/client";
import { formatMoney, formatMoneyFromDecimal } from "@/lib/financial/money";
import { MoneyYearForm } from "./money-year-form";
import { QuarterlyPlanForm } from "./quarterly-plan-form";
import { MajorExpenseForm } from "./major-expense-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { asTrigger } from "@/lib/as-trigger";

const STATUS_BADGE_CLASS: Record<string, string> = {
  ahead: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  on_track: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  behind: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const BAR_CLASS: Record<string, string> = {
  ahead: "bg-emerald-500",
  on_track: "bg-sky-500",
  behind: "bg-red-500",
};

function ProgressBar({ percent, status }: { percent: number; status: string }) {
  // bg-foreground/10 (a relative darkening), not bg-muted — this renders
  // inside both a plain default Card (below, quarter summaries) and a
  // "soft" Card (above, the metric grid), and bg-muted resolves to the
  // EXACT same color as a soft Card's own background, making the track
  // invisible there (the same bug found and fixed on the Emergency Fund
  // card earlier). A proportional overlay stays visible against either.
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
      <div className={`h-full rounded-full ${BAR_CLASS[status]}`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

interface MoneyYearViewProps {
  year: number;
  metrics: AnnualMetric[];
  moneyYearId: string;
  quarterSummaries: QuarterlySummary[];
  majorExpenses: MoneyYearMajorExpense[];
  existingQuarters: QuarterlyPlan[];
}

export function MoneyYearView({
  year,
  metrics,
  moneyYearId,
  quarterSummaries,
  majorExpenses,
  existingQuarters,
}: MoneyYearViewProps) {
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">{t("moneyYear.title")}</h2>
        <MoneyYearForm year={year} trigger={<Button variant="ghost" size="sm">{t("common.edit")}</Button>} />
      </div>

      {/* "soft" — one of several equally-weighted annual metrics, none the
          page's single hero figure (see card.tsx's own doc comment). */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.key} variant="soft">
            <CardContent className="space-y-2 pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t(`moneyYear.metrics.${metric.key}`)}</p>
                <Badge className={STATUS_BADGE_CLASS[metric.status]}>{t(`moneyYear.status.${metric.status}`)}</Badge>
              </div>
              <p className="text-xl font-bold">{formatMoney(metric.progress.actualCents)}</p>
              <ProgressBar percent={metric.progress.percent} status={metric.status} />
              <p className="text-xs text-muted-foreground">
                {t("moneyYear.target")}: {formatMoney(metric.progress.targetCents)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("moneyYear.quarters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((quarter) => {
            const summary = quarterSummaries.find((q) => q.plan.quarter === quarter);
            const existing = existingQuarters.find((q) => q.quarter === quarter);
            return (
              <div key={quarter} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {t("moneyYear.quarter")} {quarter}
                  </p>
                  <QuarterlyPlanForm
                    moneyYearId={moneyYearId}
                    quarter={quarter}
                    existing={existing}
                    trigger={
                      <Button variant="ghost" size="sm">
                        {existing ? t("common.edit") : t("moneyYear.addQuarterPlan")}
                      </Button>
                    }
                  />
                </div>
                {summary ? (
                  <div className="space-y-1.5">
                    {summary.metrics.map((m) => (
                      <div key={m.key} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{t(`moneyYear.metrics.${m.key}`)}</span>
                          <span>{m.progress.percent.toFixed(0)}%</span>
                        </div>
                        <ProgressBar percent={m.progress.percent} status={m.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("moneyYear.addQuarterPlan")}</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("moneyYear.majorExpenses")}</CardTitle>
          <MajorExpenseForm moneyYearId={moneyYearId} />
        </CardHeader>
        <CardContent className="space-y-2">
          {majorExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("moneyYear.addMajorExpense")}</p>
          ) : (
            majorExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <Checkbox
                    checked={expense.is_paid}
                    disabled={isPending}
                    onCheckedChange={(checked) =>
                      startTransition(async () => {
                        await toggleMajorExpensePaid(expense.id, checked === true);
                      })
                    }
                  />
                  <span className={`min-w-0 truncate ${expense.is_paid ? "text-muted-foreground line-through" : ""}`}>
                    {expense.name}
                  </span>
                  {expense.planned_month ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "short", year: "numeric" }).format(
                        new Date(`${expense.planned_month}T00:00:00`)
                      )}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-medium">{formatMoneyFromDecimal(expense.amount)}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      {...asTrigger(
                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t("common.moreActions")}>
                          <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => startTransition(async () => { await deleteMajorExpense(expense.id); })}
                      >
                        {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
