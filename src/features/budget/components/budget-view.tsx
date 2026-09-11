"use client";

import { useTransition } from "react";
import { MoreVertical } from "lucide-react";

import type { Category } from "@/types/database";
import type { BudgetSummary } from "@/features/budget/queries";
import { deleteBudgetCategory } from "@/features/budget/actions";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { BudgetForm } from "./budget-form";
import { CategoryBudgetForm } from "./category-budget-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { asTrigger } from "@/lib/as-trigger";

const STATUS_BADGE_CLASS: Record<string, string> = {
  no_budget: "bg-muted text-muted-foreground",
  healthy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  near_limit: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  over_budget: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const BAR_COLOR_CLASS: Record<string, string> = {
  no_budget: "bg-muted-foreground/30",
  healthy: "bg-emerald-500",
  near_limit: "bg-amber-500",
  over_budget: "bg-red-500",
};

function ProgressBar({ percent, status }: { percent: number; status: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${BAR_COLOR_CLASS[status]}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export function BudgetView({ summary, categories, month }: { summary: BudgetSummary; categories: Category[]; month: string }) {
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const { budget, overall, byCategory, categories: budgetCategories } = summary;

  const categoryName = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return t("transactions.uncategorized");
    return locale === "th" ? cat.name_th : cat.name_en;
  };

  const unallocatedCategories = categories.filter(
    (c) => !budgetCategories.some((bc) => bc.category_id === c.id) && c.type !== "income"
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("budget.currentMonth")}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_BADGE_CLASS[overall.status]}>{t(`budget.status.${overall.status}`)}</Badge>
            <BudgetForm budget={budget} month={month} trigger={<Button variant="ghost" size="sm">{t("common.edit")}</Button>} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold">{formatMoney(overall.spentCents)}</span>
            <span className="text-sm text-muted-foreground">
              {t("budget.spent")} / {formatMoney(overall.budgetCents)}
            </span>
          </div>
          <ProgressBar percent={overall.percentUsed} status={overall.status} />
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-muted-foreground">{t("budget.remaining")}</p>
              <p className={`font-medium ${overall.remainingCents < 0 ? "text-destructive" : ""}`}>
                {formatMoney(overall.remainingCents)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("budget.percentUsed")}</p>
              <p className="font-medium">{overall.percentUsed.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("budget.projected")}</p>
              <p className="font-medium">{formatMoney(overall.projectedEndOfMonthCents)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("budget.categoryBudgets")}</CardTitle>
          {unallocatedCategories.length > 0 ? (
            <CategoryBudgetForm budgetId={budget.id} categories={unallocatedCategories} />
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("budget.addCategoryBudget")}</p>
          ) : (
            byCategory.map((cb) => {
              const budgetCategory = budgetCategories.find((bc) => bc.category_id === cb.categoryId);
              return (
                <div key={cb.categoryId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      {categoryName(cb.categoryId)}
                      {cb.isFixed ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("budget.fixed")}
                        </Badge>
                      ) : null}
                      {!cb.isEssential ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("budget.discretionary")}
                        </Badge>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">
                        {formatMoney(cb.spentCents)} / {formatMoney(cb.budgetCents)}
                      </span>
                      {budgetCategory ? (
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
                              disabled={isPending}
                              onClick={() =>
                                startTransition(async () => {
                                  await deleteBudgetCategory(budgetCategory.id);
                                })
                              }
                            >
                              {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </div>
                  <ProgressBar percent={cb.percentUsed} status={cb.status} />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
