"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";

import { centsToNumber, formatMoney } from "@/lib/financial/money";
import { useTranslation } from "@/i18n/client";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { calculateChangePercent } from "@/lib/financial/calculations";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { IncomeExpenseOverviewPoint, IncomeExpensePeriod } from "@/features/dashboard/queries";

// 2026-09 motion system: charts animate once on first appearance only
// (Recharts' own animation triggers on mount/data-key change, never on
// hover) — duration/easing pulled from the shared --motion-chart token
// range (500-800ms). Disabled outright under prefers-reduced-motion, since
// Recharts' animation is JS-driven (react-smooth), not a CSS
// transition/animation the global reduced-motion kill switch can reach.
const CHART_ANIMATION_DURATION_MS = 650;

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// 2026-09 soft area-chart restyle (user-supplied hex values) — shared by
// IncomeVsExpenseChart and IncomeExpenseOverviewCard's trend line/fill.
const TREND_COLORS = {
  incomeLine: "#73C9A6",
  incomeFill: "rgba(115, 201, 166, 0.18)",
  expenseLine: "#D96B78",
  expenseFill: "rgba(217, 107, 120, 0.14)",
} as const;

function IncomeExpenseAreaTooltip({
  active,
  payload,
  label,
  currencyCode,
  incomeLabel,
  expenseLabel,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  currencyCode: string;
  incomeLabel: string;
  expenseLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const incomeCents = payload.find((p) => p.dataKey === "incomeCents")?.value ?? 0;
  const expensesCents = payload.find((p) => p.dataKey === "expensesCents")?.value ?? 0;

  return (
    <div className="min-w-40 rounded-xl border bg-popover px-3.5 py-2.5 text-sm text-popover-foreground shadow-lg">
      <p className="pb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: TREND_COLORS.incomeLine }}
              aria-hidden="true"
            />
            {incomeLabel}
          </span>
          <span className="font-semibold">{formatMoney(incomeCents, currencyCode)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: TREND_COLORS.expenseLine }}
              aria-hidden="true"
            />
            {expenseLabel}
          </span>
          <span className="font-semibold">{formatMoney(expensesCents, currencyCode)}</span>
        </div>
      </div>
    </div>
  );
}

export interface IncomeVsExpenseTrendPoint {
  /** Already formatted for display (locale-aware short month name) — see dashboard/page.tsx. */
  month: string;
  incomeCents: number;
  expensesCents: number;
}

interface IncomeVsExpenseChartProps {
  data: IncomeVsExpenseTrendPoint[];
  currencyCode: string;
}

/**
 * Soft area-line trend (2026-09 restyle, user-supplied color spec) —
 * replaces the previous single-month 2-bar comparison with a real 6-month
 * history (same "last 6 months" window as the net worth trend chart), so
 * this reads as an actual trend rather than a single snapshot.
 */
export function IncomeVsExpenseChart({ data, currencyCode }: IncomeVsExpenseChartProps) {
  const { t, locale } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const hasData = data.some((d) => d.incomeCents > 0 || d.expensesCents > 0);

  // Full 6+ digit numbers (e.g. "600000") don't fit the axis's reserved
  // width and get clipped at the SVG's left edge — compact notation
  // ("600K") is both short enough to never clip and easier to read at a
  // glance than a long uncomma'd number.
  const compactNumberFormatter = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", {
    notation: "compact",
    compactDisplay: "short",
  });

  const incomeLabel = t("transactions.types.income");
  const expenseLabel = t("transactions.types.expense");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.incomeVsExpense")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <ChartEmptyState message={t("dashboard.noIncomeExpenseData")} />
        ) : (
          <>
            {/* A line/area chart conveys this trend visually only — a
                screen-reader-only text summary gives an equivalent
                alternative without changing the visual design. */}
            <p className="sr-only">
              {data
                .map(
                  (d) =>
                    `${d.month}: ${incomeLabel} ${formatMoney(d.incomeCents, currencyCode)}, ${expenseLabel} ${formatMoney(d.expensesCents, currencyCode)}`
                )
                .join(". ")}
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  {/* Soft top-to-bottom fade to fully transparent — a
                      subtle tint under the line, never a solid block. */}
                  <linearGradient id="incomeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TREND_COLORS.incomeFill} stopOpacity={1} />
                    <stop offset="100%" stopColor={TREND_COLORS.incomeFill} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TREND_COLORS.expenseFill} stopOpacity={1} />
                    <stop offset="100%" stopColor={TREND_COLORS.expenseFill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal vertical={false} stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.6} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontWeight: 500 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(value: number) => compactNumberFormatter.format(centsToNumber(value))}
                  width={44}
                />
                <Tooltip
                  content={
                    <IncomeExpenseAreaTooltip currencyCode={currencyCode} incomeLabel={incomeLabel} expenseLabel={expenseLabel} />
                  }
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={32}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="incomeCents"
                  name={incomeLabel}
                  stroke={TREND_COLORS.incomeLine}
                  strokeWidth={2.5}
                  fill="url(#incomeAreaGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={!reducedMotion}
                  animationDuration={CHART_ANIMATION_DURATION_MS}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="expensesCents"
                  name={expenseLabel}
                  stroke={TREND_COLORS.expenseLine}
                  strokeWidth={2.5}
                  fill="url(#expenseAreaGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={!reducedMotion}
                  animationDuration={CHART_ANIMATION_DURATION_MS}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </>
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

// Bright, muted "Apple-like" expense-category palette (2026-09 v2.4,
// user-supplied hex values) — no orange, no saturated/neon tones.
const SPENDING_CATEGORY_COLORS = ["#7FAF9F", "#9CB6C8", "#B8B0CC", "#B8C2B0", "#C5C7CC"];

function CategorySpendingTooltip({
  active,
  payload,
  currencyCode,
}: {
  active?: boolean;
  payload?: { value: number; payload: { label: string; color: string } }[];
  currencyCode: string;
}) {
  if (!active || !payload?.length) return null;
  const { value, payload: row } = payload[0];
  return (
    <div className="rounded-xl border bg-popover px-3.5 py-2.5 text-sm text-popover-foreground shadow-lg">
      <div className="flex items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
        <p className="font-medium">{row.label}</p>
      </div>
      <p className="pt-0.5 text-base font-semibold">{formatMoney(value, currencyCode)}</p>
    </div>
  );
}

export function SpendingByCategoryChart({ data, currencyCode }: SpendingByCategoryChartProps) {
  const { t, locale } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  // calculateSpendingByCategory() (src/lib/financial/calculations.ts) already
  // sorts descending by totalCents before this data ever reaches the chart —
  // untouched here, this component only ever renders in the order it's given.
  const top = data.slice(0, MAX_SLICES);
  const rest = data.slice(MAX_SLICES);
  const otherTotal = rest.reduce((sum, entry) => sum + entry.totalCents, 0);

  const nameFor = (entry: SpendingByCategoryChartProps["data"][number]) =>
    (locale === "th" ? entry.categoryNameTh : entry.categoryNameEn) ?? t("transactions.uncategorized");

  const chartData = [
    ...top.map((entry) => ({ label: nameFor(entry), raw: entry.totalCents })),
    ...(otherTotal > 0 ? [{ label: t("dashboard.other"), raw: otherTotal }] : []),
  ].map((entry, index) => ({ ...entry, color: SPENDING_CATEGORY_COLORS[index % SPENDING_CATEGORY_COLORS.length] }));

  return (
    // 2026-09 v2.4: no bespoke card styling here anymore — the shared Card
    // (white surface, subtle border/shadow) now matches this chart's
    // requirements exactly via the global token update, so it stays
    // consistent with every other financial card in the app.
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.spendingByCategory")}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <ChartEmptyState message={t("dashboard.noExpenseData")} />
        ) : (
          <>
            <p className="sr-only">
              {chartData.map((d) => `${d.label}: ${formatMoney(d.raw, currencyCode)}`).join(". ")}
            </p>
            <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 48)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 56, left: 8, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="4 4" strokeOpacity={0.6} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={96}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12.5, fontWeight: 500 }}
                />
                <Tooltip
                  content={<CategorySpendingTooltip currencyCode={currencyCode} />}
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                />
                <Bar
                  dataKey="raw"
                  radius={[8, 8, 8, 8]}
                  maxBarSize={28}
                  isAnimationActive={!reducedMotion}
                  animationDuration={CHART_ANIMATION_DURATION_MS}
                  animationEasing="ease-out"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="raw"
                    position="right"
                    formatter={(value: string | number | boolean | null | undefined) =>
                      typeof value === "number" ? formatMoney(value, currencyCode) : ""
                    }
                    style={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface GoalProgressRingProps {
  progress: number;
  label: string;
}

/** Compact goal ring, code-split with the dashboard's other Recharts widgets. */
export function GoalProgressRing({ progress, label }: GoalProgressRingProps) {
  const reducedMotion = usePrefersReducedMotion();
  const safeProgress = Math.min(100, Math.max(0, progress));
  const data = [
    { name: "progress", value: safeProgress },
    { name: "remaining", value: Math.max(0, 100 - safeProgress) },
  ];

  return (
    <div className="relative size-20 shrink-0 sm:size-24" role="img" aria-label={`${label}: ${safeProgress.toFixed(0)}%`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
            isAnimationActive={!reducedMotion}
            animationDuration={CHART_ANIMATION_DURATION_MS}
          >
            <Cell fill="var(--primary)" />
            <Cell fill="var(--muted)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums sm:text-lg">
        {safeProgress.toFixed(0)}%
      </span>
    </div>
  );
}

interface IncomeExpenseOverviewCardProps {
  /** All three period buckets, computed once server-side (getIncomeExpenseOverview) — switching the selector below is a pure client-side slice, no refetch. */
  data: Record<IncomeExpensePeriod, IncomeExpenseOverviewPoint[]>;
  currencyCode: string;
}

const PERIOD_OPTIONS: IncomeExpensePeriod[] = ["week", "month", "year"];

/**
 * "เดือนนี้" card's 2026-09 replacement — a period-switchable (week/month/
 * year) Income vs Expense area trend, reusing the same soft-gradient visual
 * language as IncomeVsExpenseChart (deliberately separate TREND_COLORS-
 * keyed gradient ids below — `overviewIncomeGradient`/`overviewExpenseGradient`
 * — since both charts can be on the page at once and SVG gradient ids are
 * global to the document).
 *
 * The headline number is the selected period's net (income − expenses),
 * not the raw income figure some reference designs use for this slot —
 * kept deliberately, since "คงเหลือ" (net remaining) is what the donut card
 * this replaces always centered, and it stays the more directly actionable
 * number for this product than income alone.
 */
export function IncomeExpenseOverviewCard({ data, currencyCode }: IncomeExpenseOverviewCardProps) {
  const { t, locale } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const [period, setPeriod] = useState<IncomeExpensePeriod>("month");

  const points = data[period];
  const hasData = points.some((p) => p.incomeCents > 0 || p.expensesCents > 0);
  const dtLocale = locale === "th" ? "th-TH" : "en-US";

  const compactNumberFormatter = useMemo(
    () => new Intl.NumberFormat(dtLocale, { notation: "compact", compactDisplay: "short" }),
    [dtLocale]
  );
  const pointLabelFormatter = useMemo(() => {
    const options: Intl.DateTimeFormatOptions =
      period === "year"
        ? { year: "numeric" }
        : period === "week"
          ? { day: "numeric", month: "short" }
          : { month: "short" };
    return new Intl.DateTimeFormat(dtLocale, options);
  }, [period, dtLocale]);
  const headlineDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(dtLocale, { day: "numeric", month: "long", year: "numeric" }),
    [dtLocale]
  );

  const formatPointLabel = (point: IncomeExpenseOverviewPoint) =>
    pointLabelFormatter.format(new Date(`${point.periodStart}T00:00:00`));

  const chartData = points.map((point) => ({
    label: formatPointLabel(point),
    incomeCents: point.incomeCents,
    expensesCents: point.expensesCents,
  }));

  const latest = points[points.length - 1] as IncomeExpenseOverviewPoint | undefined;
  const previous = points[points.length - 2] as IncomeExpenseOverviewPoint | undefined;
  const latestNetCents = latest ? latest.incomeCents - latest.expensesCents : 0;
  const previousNetCents = previous ? previous.incomeCents - previous.expensesCents : null;
  const netChangePercent = previous ? calculateChangePercent(latestNetCents, previousNetCents ?? 0) : null;

  const incomeLabel = t("transactions.types.income");
  const expenseLabel = t("transactions.types.expense");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.incomeExpenseOverview")}</CardTitle>
        <CardAction>
          <Select value={period} onValueChange={(value) => setPeriod(value as IncomeExpensePeriod)}>
            <SelectTrigger size="sm" aria-label={t("dashboard.selectPeriod")}>
              <SelectValue>{t(`dashboard.period.${period}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`dashboard.period.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <ChartEmptyState message={t("dashboard.noIncomeExpenseDataPeriod")} />
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard.remaining")}</p>
                <p className={`text-2xl font-bold tabular-nums ${latestNetCents < 0 ? "text-destructive" : ""}`}>
                  {formatMoney(latestNetCents, currencyCode)}
                </p>
              </div>
              {netChangePercent !== null && latest ? (
                <div
                  className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium ${
                    netChangePercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {netChangePercent >= 0 ? (
                      <TrendingUp className="size-3.5" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="size-3.5" aria-hidden="true" />
                    )}
                    {netChangePercent >= 0 ? "+" : ""}
                    {netChangePercent.toFixed(1)}%
                  </span>
                  <span className="font-normal text-muted-foreground">
                    {t("dashboard.vsPreviousPeriod")} · {headlineDateFormatter.format(new Date(`${latest.periodStart}T00:00:00`))}
                  </span>
                </div>
              ) : null}
            </div>

            {/* A line/area chart conveys this trend visually only — a
                screen-reader-only text summary gives an equivalent
                alternative without changing the visual design. */}
            <p className="sr-only">
              {points.map((point) => `${formatPointLabel(point)}: ${incomeLabel} ${formatMoney(point.incomeCents, currencyCode)}, ${expenseLabel} ${formatMoney(point.expensesCents, currencyCode)}`).join(". ")}
            </p>

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="overviewIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TREND_COLORS.incomeFill} stopOpacity={1} />
                    <stop offset="100%" stopColor={TREND_COLORS.incomeFill} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="overviewExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TREND_COLORS.expenseFill} stopOpacity={1} />
                    <stop offset="100%" stopColor={TREND_COLORS.expenseFill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal vertical={false} stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.6} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontWeight: 500 }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(value: number) => compactNumberFormatter.format(centsToNumber(value))}
                  width={44}
                />
                <Tooltip
                  content={
                    <IncomeExpenseAreaTooltip currencyCode={currencyCode} incomeLabel={incomeLabel} expenseLabel={expenseLabel} />
                  }
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={32}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="incomeCents"
                  name={incomeLabel}
                  stroke={TREND_COLORS.incomeLine}
                  strokeWidth={2.5}
                  fill="url(#overviewIncomeGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={!reducedMotion}
                  animationDuration={CHART_ANIMATION_DURATION_MS}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="expensesCents"
                  name={expenseLabel}
                  stroke={TREND_COLORS.expenseLine}
                  strokeWidth={2.5}
                  fill="url(#overviewExpenseGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={!reducedMotion}
                  animationDuration={CHART_ANIMATION_DURATION_MS}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
