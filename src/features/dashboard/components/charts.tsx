"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/shared/icon-chip";

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

// Bright, muted "Apple-like" finance palette (2026-09 v2.4, user-supplied
// hex values) — dedicated to this chart, not the shared --chart-* tokens.
const INCOME_EXPENSE_COLORS = {
  income: "#7FD6B2",
  expense: "#8EA2B8",
} as const;

function IncomeExpenseTooltip({
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
  const { t, locale } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const hasData = incomeCents > 0 || expensesCents > 0;

  // Full 6+ digit numbers (e.g. "600000") don't fit the axis's reserved
  // width and get clipped at the SVG's left edge — compact notation
  // ("600K") is both short enough to never clip and easier to read at a
  // glance than a long uncomma'd number.
  const compactNumberFormatter = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", {
    notation: "compact",
    compactDisplay: "short",
  });

  const data = [
    {
      label: t("transactions.types.income"),
      value: centsToNumber(incomeCents),
      raw: incomeCents,
      color: INCOME_EXPENSE_COLORS.income,
      gradientId: "incomeBarGradient",
    },
    {
      label: t("transactions.types.expense"),
      value: centsToNumber(expensesCents),
      raw: expensesCents,
      color: INCOME_EXPENSE_COLORS.expense,
      gradientId: "expenseBarGradient",
    },
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
          <>
            {/* Day 8 accessibility audit: a bar chart conveys these two
                numbers visually only — a screen-reader-only text summary
                gives an equivalent alternative without changing the visual
                design. */}
            <p className="sr-only">
              {data.map((d) => `${d.label}: ${formatMoney(d.raw, currencyCode)}`).join(". ")}
            </p>
            <ResponsiveContainer width="100%" height={224}>
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                barCategoryGap="35%"
              >
                <defs>
                  {/* Subtle top-to-bottom gradient in each bar's own tone —
                      soft/premium, not a neon multi-color gradient. */}
                  <linearGradient id="incomeBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INCOME_EXPENSE_COLORS.income} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={INCOME_EXPENSE_COLORS.income} stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="expenseBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INCOME_EXPENSE_COLORS.expense} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={INCOME_EXPENSE_COLORS.expense} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" strokeOpacity={0.6} />
                <XAxis
                  dataKey="label"
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
                  content={<IncomeExpenseTooltip currencyCode={currencyCode} />}
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                />
                <Bar
                  dataKey="raw"
                  radius={[10, 10, 0, 0]}
                  maxBarSize={56}
                  isAnimationActive={!reducedMotion}
                  animationDuration={CHART_ANIMATION_DURATION_MS}
                  animationEasing="ease-out"
                >
                  {data.map((entry) => (
                    <Cell key={entry.label} fill={`url(#${entry.gradientId})`} />
                  ))}
                </Bar>
              </BarChart>
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

interface MonthlyDonutCardProps {
  incomeCents: number;
  expensesCents: number;
  cashFlowCents: number;
  currencyCode: string;
  labels: { title: string; income: string; expenses: string; remaining: string };
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

/**
 * "This month" hero-style widget — a donut ring (income vs. expenses, same
 * palette as IncomeVsExpenseChart) with the net remaining amount centered
 * in the ring's hole. Intentionally does NOT handle the "no data this
 * month" case itself: the caller (dashboard page) only renders this when
 * SummaryCards' own `hasDataThisMonth` is true, so there's exactly one
 * empty-state message on the page (SummaryCards'), not two.
 */
export function MonthlyDonutCard({ incomeCents, expensesCents, cashFlowCents, currencyCode, labels }: MonthlyDonutCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const data = [
    { name: "income", value: Math.max(0, incomeCents) },
    { name: "expenses", value: Math.max(0, expensesCents) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative size-28 shrink-0 sm:size-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius="70%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                  isAnimationActive={!reducedMotion}
                  animationDuration={CHART_ANIMATION_DURATION_MS}
                >
                  <Cell fill={INCOME_EXPENSE_COLORS.income} />
                  <Cell fill="#E5989B" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-[11px] text-muted-foreground">{labels.remaining}</p>
              <p className={`max-w-[80%] break-all text-sm font-bold leading-tight tabular-nums sm:text-lg ${cashFlowCents < 0 ? "text-destructive" : ""}`}>
                {formatMoney(cashFlowCents, currencyCode)}
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <IconChip icon={TrendingUp} tone="mint" className="size-8" />
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{labels.income}</p>
                <p className="break-all text-sm font-semibold tabular-nums sm:text-base">{formatMoney(incomeCents, currencyCode)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IconChip icon={TrendingDown} tone="rose" className="size-8" />
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{labels.expenses}</p>
                <p className="break-all text-sm font-semibold tabular-nums sm:text-base">{formatMoney(expensesCents, currencyCode)}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
