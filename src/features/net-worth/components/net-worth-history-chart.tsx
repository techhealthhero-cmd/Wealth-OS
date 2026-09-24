"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/lib/financial/money";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface NetWorthHistoryChartPoint {
  date: string;
  netWorth: number;
}

/**
 * Extracted from net-worth-view.tsx (perf audit finding) so just the chart —
 * not the whole view, which mixes chart and non-chart UI — can be lazy-
 * loaded via ./charts-lazy.tsx, the same next/dynamic({ ssr: false })
 * pattern the dashboard's charts already use.
 */
export function NetWorthHistoryChart({ data }: { data: NetWorthHistoryChartPoint[] }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
  );
}
