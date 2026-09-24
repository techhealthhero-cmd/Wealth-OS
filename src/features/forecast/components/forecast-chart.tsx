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
}

/**
 * Extracted from forecast-view.tsx (perf audit finding) so just the chart —
 * not the whole view, which mixes chart and stateful scenario/what-if UI —
 * can be lazy-loaded via ./charts-lazy.tsx, the same next/dynamic({ ssr:
 * false }) pattern the dashboard's charts and net-worth-view.tsx's chart
 * already use.
 */
export function ForecastChart({ data, hasWhatIf, monthLabel }: ForecastChartProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="month"
          tickFormatter={monthLabel}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tick={{ fontSize: 11 }}
        />
        <YAxis hide />
        <Tooltip labelFormatter={(m) => monthLabel(Number(m))} formatter={(value) => formatMoney(Number(value))} />
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
