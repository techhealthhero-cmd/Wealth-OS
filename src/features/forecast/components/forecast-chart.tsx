"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/lib/financial/money";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface ForecastChartPoint {
  month: number;
  netWorth: number;
  whatIfNetWorth?: number;
}

interface ForecastChartProps {
  data: ForecastChartPoint[];
  hasWhatIf: boolean;
  monthLabel: (month: number) => string;
  /** "highlight" when the surrounding Card uses variant="highlight" — see the tone-specific colors below for why this can't just reuse the default styling. */
  tone?: "highlight" | "default";
}

/**
 * Extracted from forecast-view.tsx (perf audit finding) so just the chart —
 * not the whole view, which mixes chart and stateful scenario/what-if UI —
 * can be lazy-loaded via ./charts-lazy.tsx, the same next/dynamic({ ssr:
 * false }) pattern the dashboard's charts and net-worth-view.tsx's chart
 * already use.
 */
export function ForecastChart({ data, hasWhatIf, monthLabel, tone = "default" }: ForecastChartProps) {
  const reducedMotion = usePrefersReducedMotion();

  // var(--color-chart-1) resolves to the exact same color as the
  // "highlight" Card variant's own background (--primary, #1f4d3e in light
  // mode) — the line would be invisible. #7FD6B2 matches
  // net-worth-mini-chart.tsx's exact fix for the identical problem. The
  // default (non-highlight) tick/axis styling is left byte-identical to
  // before — only the highlight tone gets explicit on-dark colors.
  const primaryStroke = tone === "highlight" ? "#7FD6B2" : "var(--color-chart-1)";

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="month"
          tickFormatter={monthLabel}
          tickLine={false}
          axisLine={{ stroke: tone === "highlight" ? "rgba(255,255,255,0.25)" : "var(--border)" }}
          tick={tone === "highlight" ? { fontSize: 11, fill: "rgba(255,255,255,0.7)" } : { fontSize: 11 }}
        />
        <YAxis hide />
        <Tooltip labelFormatter={(m) => monthLabel(Number(m))} formatter={(value) => formatMoney(Number(value))} />
        <Line
          type="monotone"
          dataKey="netWorth"
          stroke={primaryStroke}
          strokeWidth={2}
          dot={false}
          isAnimationActive={!reducedMotion}
          animationDuration={650}
          animationEasing="ease-out"
        />
        {hasWhatIf ? (
          <Line
            type="monotone"
            dataKey="whatIfNetWorth"
            stroke="var(--color-chart-2)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={!reducedMotion}
            animationDuration={650}
            animationEasing="ease-out"
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
