"use client";

import { useActionState } from "react";

import { saveOrCompleteMonthlyReview } from "@/features/monthly-review/actions";
import type { MonthlyReviewSnapshot } from "@/features/monthly-review/queries";
import type { MonthlyReview } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function MonthlyReviewView({
  year,
  month,
  snapshot,
  existing,
}: {
  year: number;
  month: number;
  snapshot: MonthlyReviewSnapshot;
  existing: MonthlyReview | null;
}) {
  const { t } = useTranslation();
  const isCompleted = existing?.completed_at != null;

  const action = saveOrCompleteMonthlyReview.bind(null, year, month);
  const [state, formAction, isPending] = useActionState(action, undefined);

  const na = t("monthlyReview.noData");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("monthlyReview.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StatRow label={t("monthlyReview.income")} value={formatMoney(snapshot.incomeCents)} />
          <StatRow label={t("monthlyReview.expenses")} value={formatMoney(snapshot.expensesCents)} />
          <StatRow label={t("monthlyReview.cashFlow")} value={formatMoney(snapshot.cashFlowCents)} />
          <StatRow label={t("monthlyReview.savingsRate")} value={`${snapshot.savingsRatePercent.toFixed(1)}%`} />
          <StatRow
            label={t("monthlyReview.netWorthChange")}
            value={snapshot.netWorthChangeCents !== null ? formatMoney(snapshot.netWorthChangeCents) : na}
          />
          <StatRow
            label={t("monthlyReview.budgetPerformance")}
            value={snapshot.budgetPercentUsed !== null ? `${snapshot.budgetPercentUsed.toFixed(0)}%` : na}
          />
          <StatRow label={t("monthlyReview.debtProgress")} value={formatMoney(snapshot.debtPaidCents)} />
          <StatRow
            label={t("monthlyReview.emergencyFundProgress")}
            value={snapshot.emergencyFundMonthsProtected !== null ? `${snapshot.emergencyFundMonthsProtected.toFixed(1)}` : na}
          />
          <StatRow
            label={t("monthlyReview.goalsProgress")}
            value={snapshot.goalsProgressPercent !== null ? `${snapshot.goalsProgressPercent.toFixed(0)}%` : na}
          />
          <StatRow
            label={t("monthlyReview.incomeGapProgress")}
            value={snapshot.incomeGapCents !== null ? formatMoney(snapshot.incomeGapCents) : na}
          />
          <StatRow label={t("monthlyReview.missionsCompleted")} value={String(snapshot.missionsCompletedCount)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("monthlyReview.reflectionTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isCompleted ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-emerald-600 dark:text-emerald-400">{t("monthlyReview.alreadyCompleted")}</p>
              {existing?.what_went_well ? (
                <div>
                  <p className="text-muted-foreground">{t("monthlyReview.whatWentWell")}</p>
                  <p>{existing.what_went_well}</p>
                </div>
              ) : null}
              {existing?.what_to_reduce ? (
                <div>
                  <p className="text-muted-foreground">{t("monthlyReview.whatToReduce")}</p>
                  <p>{existing.what_to_reduce}</p>
                </div>
              ) : null}
              {existing?.next_month_focus ? (
                <div>
                  <p className="text-muted-foreground">{t("monthlyReview.nextMonthFocus")}</p>
                  <p>{existing.next_month_focus}</p>
                </div>
              ) : null}
              {existing?.notes ? (
                <div>
                  <p className="text-muted-foreground">{t("monthlyReview.notesLabel")}</p>
                  <p>{existing.notes}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="what_went_well">{t("monthlyReview.whatWentWell")}</Label>
                <Textarea id="what_went_well" name="what_went_well" defaultValue={existing?.what_went_well ?? ""} maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="what_to_reduce">{t("monthlyReview.whatToReduce")}</Label>
                <Textarea id="what_to_reduce" name="what_to_reduce" defaultValue={existing?.what_to_reduce ?? ""} maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_month_focus">{t("monthlyReview.nextMonthFocus")}</Label>
                <Textarea id="next_month_focus" name="next_month_focus" defaultValue={existing?.next_month_focus ?? ""} maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t("monthlyReview.notesLabel")}</Label>
                <Textarea id="notes" name="notes" defaultValue={existing?.notes ?? ""} maxLength={500} />
              </div>

              {state?.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {state.error}
                </p>
              ) : null}

              <div className="flex gap-2">
                <Button type="submit" name="intent" value="draft" variant="outline" disabled={isPending}>
                  {isPending ? t("common.saving") : t("monthlyReview.saveDraft")}
                </Button>
                <Button type="submit" name="intent" value="complete" disabled={isPending}>
                  {isPending ? t("common.saving") : t("monthlyReview.complete")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
