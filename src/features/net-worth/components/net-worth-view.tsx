"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { NetWorthSnapshot } from "@/types/database";
import type { NetWorthBreakdown } from "@/features/net-worth/queries";
import { useTranslation } from "@/i18n/client";
import { formatMoney, formatMoneyFromDecimal, parseMoneyToCents } from "@/lib/financial/money";
import { calculateNetWorthChange } from "@/lib/financial/net-worth";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NetWorthViewProps {
  breakdown: NetWorthBreakdown;
  snapshots: NetWorthSnapshot[];
}

export function NetWorthView({ breakdown, snapshots }: NetWorthViewProps) {
  const { t, locale } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();

  const previousSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const change = calculateNetWorthChange(
    breakdown.netWorthCents,
    previousSnapshot ? parseMoneyToCents(previousSnapshot.net_worth) : 0
  );

  const chartData = snapshots.map((s) => ({
    date: new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "short", day: "numeric" }).format(
      new Date(`${s.snapshot_date}T00:00:00`)
    ),
    netWorth: parseMoneyToCents(s.net_worth),
  }));

  const includedAssets = breakdown.assets.filter((a) => a.include_in_net_worth && !a.linked_account_id);
  const includedLiabilities = breakdown.liabilities.filter((l) => l.include_in_net_worth);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-1 pt-6 text-center">
          <p className="text-sm text-muted-foreground">{t("netWorth.currentNetWorth")}</p>
          <p className={`text-3xl font-bold ${breakdown.netWorthCents < 0 ? "text-destructive" : ""}`}>
            {formatMoney(breakdown.netWorthCents)}
          </p>
          {previousSnapshot ? (
            <p className={`text-sm ${change.changeCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
              {change.changeCents >= 0 ? "+" : ""}
              {formatMoney(change.changeCents)} {t("netWorth.monthlyChange")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t("netWorth.totalAssets")}</p>
            <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
              {formatMoney(breakdown.totalAssetsCents)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t("netWorth.totalLiabilities")}</p>
            <p className="text-xl font-semibold text-destructive">{formatMoney(breakdown.totalLiabilitiesCents)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("netWorth.history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length < 2 ? (
            <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
              {t("netWorth.noHistoryYet")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 11 }} />
                <YAxis hide />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!reducedMotion}
                  animationDuration={650}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("netWorth.assetBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {breakdown.accountAssetsCents > 0 ? (
            <div className="flex justify-between text-sm">
              <span>{t("netWorth.accounts")}</span>
              <span className="font-medium">{formatMoney(breakdown.accountAssetsCents)}</span>
            </div>
          ) : null}
          {includedAssets.map((asset) => (
            <div key={asset.id} className="flex justify-between text-sm">
              <span>{asset.name}</span>
              <span className="font-medium">{formatMoneyFromDecimal(asset.value, asset.currency_code)}</span>
            </div>
          ))}
          {breakdown.totalAssetsCents === 0 ? (
            <p className="text-sm text-muted-foreground">{t("assets.emptyState")}</p>
          ) : null}
        </CardContent>
      </Card>

      {includedLiabilities.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("netWorth.liabilityBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {includedLiabilities.map((liability) => (
              <div key={liability.id} className="flex justify-between text-sm">
                <span>{liability.name}</span>
                <span className="font-medium">{formatMoneyFromDecimal(liability.balance)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
