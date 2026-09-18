"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatMoney } from "@/lib/financial/money";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useTranslation } from "@/i18n/client";

interface NetWorthMiniChartPoint {
  date: string;
  netWorth: number;
}

interface NetWorthMiniChartProps {
  data: NetWorthMiniChartPoint[];
  tone: "highlight" | "default";
}

/**
 * Compact sparkline for the dashboard hero card — deliberately no axes/grid,
 * just the shape of the trend, so it reads in one glance rather than
 * competing with the headline number for attention. The full labeled chart
 * with axis/tooltip detail already exists at /money/net-worth
 * (net-worth-view.tsx); this is not a replacement, just a teaser.
 */
export function NetWorthMiniChart({ data, tone }: NetWorthMiniChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { t } = useTranslation();

  // #7FD6B2 matches the existing hardcoded positive-delta color used on the
  // dark "highlight" card background elsewhere in this component (see
  // net-worth-hero.tsx) — var(--color-chart-1) doesn't have enough contrast
  // against that same dark green background.
  const stroke = tone === "highlight" ? "#7FD6B2" : "var(--color-chart-1)";

  // The chart itself is an SVG shape a screen reader can't meaningfully
  // describe — a text summary carries the same information the sighted
  // trend line conveys (direction and magnitude over the period), rather
  // than the chart being silently skipped or read as raw SVG internals.
  const first = data[0];
  const last = data[data.length - 1];
  const summary = first && last
    ? t("netWorth.trendSummary")
        .replace("{from}", first.date)
        .replace("{fromAmount}", formatMoney(first.netWorth))
        .replace("{to}", last.date)
        .replace("{toAmount}", formatMoney(last.netWorth))
    : undefined;

  return (
    <div role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={64} aria-hidden="true">
        <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
          <Tooltip
            formatter={(value) => formatMoney(Number(value))}
            labelFormatter={(label) => label}
            contentStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="netWorth"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reducedMotion}
            animationDuration={650}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
