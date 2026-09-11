"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown } from "lucide-react";

import {
  calculateForecast,
  scenarioExtraDebtPayment,
  scenarioExtraMonthlySavings,
  scenarioExpenseChangeCents,
  scenarioIncomeChangePercent,
  scenarioLoseIncome,
  scenarioOneTimeExpense,
  type ForecastAssumptions,
  type ForecastStartingState,
} from "@/lib/financial/forecast";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { ForecastScenarioForm } from "./forecast-scenario-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ForecastScenario } from "@/types/database";

export interface ScenarioWithAssumptions {
  row: ForecastScenario;
  assumptions: ForecastAssumptions;
}

interface ForecastViewProps {
  startingState: ForecastStartingState;
  scenarios: ScenarioWithAssumptions[];
  defaultAssumptions: ForecastAssumptions;
}

type WhatIf = "saveMore" | "incomeUp" | "extraDebt" | "buyCar" | "rentUp" | "loseIncome" | null;

export function ForecastView({ startingState, scenarios, defaultAssumptions }: ForecastViewProps) {
  const { t, locale } = useTranslation();
  const [selectedId, setSelectedId] = useState(scenarios[0]?.row.id ?? null);
  const [whatIf, setWhatIf] = useState<WhatIf>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const selected = scenarios.find((s) => s.row.id === selectedId) ?? scenarios[0] ?? null;
  const assumptions = selected?.assumptions ?? defaultAssumptions;
  const horizonMonths = selected?.row.horizon_months ?? 12;

  const baseline = useMemo(
    () => calculateForecast(startingState, assumptions, horizonMonths),
    [startingState, assumptions, horizonMonths]
  );

  const whatIfResult = useMemo(() => {
    if (!whatIf) return null;
    let modifiedState = startingState;
    let modifiedAssumptions = assumptions;
    switch (whatIf) {
      case "saveMore":
        modifiedAssumptions = scenarioExtraMonthlySavings(assumptions, 500000);
        break;
      case "incomeUp":
        modifiedState = scenarioIncomeChangePercent(startingState, 10);
        break;
      case "extraDebt":
        modifiedAssumptions = scenarioExtraDebtPayment(assumptions, 300000);
        break;
      case "buyCar":
        modifiedAssumptions = scenarioOneTimeExpense(assumptions, 80000000, 1);
        break;
      case "rentUp":
        modifiedState = scenarioExpenseChangeCents(startingState, 300000);
        break;
      case "loseIncome":
        modifiedState = scenarioLoseIncome(startingState, startingState.monthlyIncomeCents);
        break;
    }
    return calculateForecast(modifiedState, modifiedAssumptions, horizonMonths);
  }, [whatIf, startingState, assumptions, horizonMonths]);

  const chartData = baseline.map((row, i) => ({
    month: row.month,
    netWorth: row.netWorthCents,
    whatIfNetWorth: whatIfResult ? whatIfResult[i].netWorthCents : undefined,
  }));

  const monthLabel = (m: number) => {
    const date = new Date();
    date.setMonth(date.getMonth() + m);
    return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "short", year: "2-digit" }).format(
      date
    );
  };

  const whatIfOptions: { key: Exclude<WhatIf, null>; labelKey: string }[] = [
    { key: "saveMore", labelKey: "forecast.whatIfSaveMore" },
    { key: "incomeUp", labelKey: "forecast.whatIfIncomeUp" },
    { key: "extraDebt", labelKey: "forecast.whatIfExtraDebt" },
    { key: "buyCar", labelKey: "forecast.whatIfBuyCar" },
    { key: "rentUp", labelKey: "forecast.whatIfRentUp" },
    { key: "loseIncome", labelKey: "forecast.whatIfLoseIncome" },
  ];

  const finalMonth = baseline[baseline.length - 1];
  const finalWhatIfMonth = whatIfResult?.[whatIfResult.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map((s) => (
          <button
            key={s.row.id}
            type="button"
            onClick={() => setSelectedId(s.row.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              selectedId === s.row.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            )}
          >
            {s.row.name}
          </button>
        ))}
        <ForecastScenarioForm
          defaults={defaultAssumptions}
          trigger={
            <Button variant="outline" size="sm">
              {t("forecast.addScenario")}
            </Button>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("forecast.projectedNetWorth")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={{ fontSize: 11 }}
              />
              <YAxis hide />
              <Tooltip labelFormatter={(m) => monthLabel(Number(m))} formatter={(value) => formatMoney(Number(value))} />
              <Line type="monotone" dataKey="netWorth" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              {whatIfResult ? (
                <Line
                  type="monotone"
                  dataKey="whatIfNetWorth"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">
              {monthLabel(horizonMonths)}: {formatMoney(finalMonth?.netWorthCents ?? 0)}
            </span>
            {finalWhatIfMonth ? (
              <span className="font-medium text-[var(--color-chart-2)]">
                {t("forecast.whatIf")}: {formatMoney(finalWhatIfMonth.netWorthCents)}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("forecast.whatIf")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {whatIfOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setWhatIf(whatIf === option.key ? null : option.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                whatIf === option.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <button
            type="button"
            onClick={() => setShowAssumptions((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-medium"
          >
            {t("forecast.viewAssumptions")}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAssumptions && "rotate-180")} aria-hidden="true" />
          </button>
          {showAssumptions ? (
            <div className="mt-3 space-y-1.5 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("forecast.incomeGrowthRate")}</span>
                <span>{assumptions.incomeGrowthRatePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("forecast.expenseGrowthRate")}</span>
                <span>{assumptions.expenseGrowthRatePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("forecast.monthlySavings")}</span>
                <span>{formatMoney(assumptions.monthlySavingsCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("forecast.monthlyInvestment")}</span>
                <span>{formatMoney(assumptions.monthlyInvestmentCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("forecast.monthlyDebtPayment")}</span>
                <span>{formatMoney(assumptions.monthlyDebtPaymentCents)}</span>
              </div>
            </div>
          ) : null}
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{t("forecast.disclaimer")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
