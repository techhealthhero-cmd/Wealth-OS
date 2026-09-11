"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { centsToNumber, formatMoney } from "@/lib/financial/money";
import { useTranslation } from "@/i18n/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Fixed categorical slot order (never cycled) — see globals.css --chart-1..5,
// sourced from the dataviz skill's validated reference palette.
const CATEGORY_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function CurrencyTooltip({
  active,
  payload,
  currencyCode,
}: {
  active?: boolean;
  payload?: { value: number; payload: { label: string } }[];
  currencyCode: string;
}) {
  if (!active || !payload?.length) return null;
  const { value, payload: row } = payload[0];
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-sm">
      <p className="font-medium">{row.label}</p>
      <p className="text-muted-foreground">{formatMoney(value, currencyCode)}</p>
    </div>
  );
}

interface IncomeVsExpenseChartProps {
  incomeCents: number;
  expensesCents: number;
  currencyCode: string;
}

export function IncomeVsExpenseChart({
  incomeCents,
  expensesCents,
  currencyCode,
}: IncomeVsExpenseChartProps) {
  const { t } = useTranslation();
  const hasData = incomeCents > 0 || expensesCents > 0;

  const data = [
    { label: t("transactions.types.income"), value: centsToNumber(incomeCents), raw: incomeCents, color: CATEGORY_COLORS[0] },
    { label: t("transactions.types.expense"), value: centsToNumber(expensesCents), raw: expensesCents, color: CATEGORY_COLORS[1] },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.incomeVsExpense")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <ChartEmptyState message={t("dashboard.noIncomeExpenseData")} />
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                width={40}
              />
              <Tooltip
                content={<CurrencyTooltip currencyCode={currencyCode} />}
                cursor={{ fill: "var(--muted)" }}
              />
              <Bar dataKey="raw" radius={[4, 4, 0, 0]} maxBarSize={64}>
                {data.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

interface SpendingByCategoryChartProps {
  data: { categoryNameEn: string | null; categoryNameTh: string | null; totalCents: number }[];
  currencyCode: string;
}

const MAX_SLICES = 5;

export function SpendingByCategoryChart({ data, currencyCode }: SpendingByCategoryChartProps) {
  const { t, locale } = useTranslation();
  const top = data.slice(0, MAX_SLICES);
  const rest = data.slice(MAX_SLICES);
  const otherTotal = rest.reduce((sum, entry) => sum + entry.totalCents, 0);

  const nameFor = (entry: SpendingByCategoryChartProps["data"][number]) =>
    (locale === "th" ? entry.categoryNameTh : entry.categoryNameEn) ?? t("transactions.uncategorized");

  const chartData = [
    ...top.map((entry) => ({ label: nameFor(entry), raw: entry.totalCents })),
    ...(otherTotal > 0 ? [{ label: t("dashboard.other"), raw: otherTotal }] : []),
  ].map((entry, index) => ({ ...entry, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.spendingByCategory")}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <ChartEmptyState message={t("dashboard.noExpenseData")} />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 40)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={110}
                tick={{ fill: "var(--foreground)", fontSize: 12 }}
              />
              <Tooltip
                content={<CurrencyTooltip currencyCode={currencyCode} />}
                cursor={{ fill: "var(--muted)" }}
              />
              <Bar dataKey="raw" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {chartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
