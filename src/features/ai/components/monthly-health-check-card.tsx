"use client";

import type { HealthCheckChange, HealthCheckItem, MonthlyHealthCheck } from "@/features/ai/lib/health-check";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NextBestActionCard } from "@/features/ai/components/next-best-action-card";

const STATUS_BADGE_CLASS: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  mixed: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  needs_attention: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

function ItemLine({ item }: { item: HealthCheckItem }) {
  const { t } = useTranslation();
  const label = t(`monthlyHealthCheck.items.${item.type}`);
  const detail =
    item.percent !== undefined
      ? `${item.percent > 0 ? "+" : ""}${item.percent.toFixed(0)}%`
      : item.amountCents !== undefined
        ? formatMoney(Math.abs(item.amountCents))
        : null;

  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      {detail ? <span className="font-medium text-muted-foreground">{detail}</span> : null}
    </li>
  );
}

function ChangeLine({ change }: { change: HealthCheckChange }) {
  const { t } = useTranslation();
  const label = t(`monthlyHealthCheck.changeItems.${change.type}`);
  const value =
    change.percent !== undefined
      ? `${change.percent > 0 ? "+" : ""}${change.percent.toFixed(0)}%`
      : change.amountCents !== undefined
        ? `${change.amountCents > 0 ? "+" : change.amountCents < 0 ? "-" : ""}${formatMoney(Math.abs(change.amountCents))}`
        : null;

  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value ? <span className="font-medium">{value}</span> : null}
    </li>
  );
}

/**
 * Fully deterministic render of `MonthlyHealthCheck` (built server-side by
 * `buildMonthlyHealthCheck`, zero LLM calls). The AI chat may narrate this
 * data conversationally if asked, but this card itself never calls a model.
 */
export function MonthlyHealthCheckCard({
  health,
  showPriorityAction = true,
}: {
  health: MonthlyHealthCheck;
  /** Set false when the caller already renders `NextBestActionCard` elsewhere on the page, to avoid showing it twice. */
  showPriorityAction?: boolean;
}) {
  const { t } = useTranslation();

  if (!health.hasEnoughData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("monthlyHealthCheck.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{t("monthlyHealthCheck.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("monthlyHealthCheck.emptyState")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("monthlyHealthCheck.title")}</CardTitle>
          <Badge className={STATUS_BADGE_CLASS[health.overallStatus]}>
            {t(`monthlyHealthCheck.status.${health.overallStatus}`)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-muted-foreground">{t("monthlyHealthCheck.positives")}</p>
            {health.positives.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("monthlyHealthCheck.noPositives")}</p>
            ) : (
              <ul className="space-y-1">
                {health.positives.map((item, i) => (
                  <ItemLine key={`${item.type}-${i}`} item={item} />
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-muted-foreground">{t("monthlyHealthCheck.risks")}</p>
            {health.risks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("monthlyHealthCheck.noRisks")}</p>
            ) : (
              <ul className="space-y-1">
                {health.risks.map((item, i) => (
                  <ItemLine key={`${item.type}-${i}`} item={item} />
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("monthlyHealthCheck.changes")}</CardTitle>
        </CardHeader>
        <CardContent>
          {health.changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("monthlyHealthCheck.noChanges")}</p>
          ) : (
            <ul className="space-y-1.5">
              {health.changes.map((change, i) => (
                <ChangeLine key={`${change.type}-${i}`} change={change} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {showPriorityAction ? (
        <div>
          <p className="mb-1.5 text-sm font-medium text-muted-foreground">{t("monthlyHealthCheck.priorityAction")}</p>
          <NextBestActionCard priority={health.priorityAction} />
        </div>
      ) : null}
    </div>
  );
}
