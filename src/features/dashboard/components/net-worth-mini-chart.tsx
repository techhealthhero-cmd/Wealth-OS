"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatMoney } from "@/lib/financial/money";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

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

  // #7FD6B2 matches the existing hardcoded positive-delta color used on the
  // dark "highlight" card background elsewhere in this component (see
  // net-worth-hero.tsx) — var(--color-chart-1) doesn't have enough contrast
  // against that same dark green background.
  const stroke = tone === "highlight" ? "#7FD6B2" : "var(--color-chart-1)";

  return (
    <ResponsiveContainer width="100%" height={64}>
      <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          wrapperStyle={{ outline: "none" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as NetWorthMiniChartPoint;
            // A plain-language "{date}: {amount}" replaces Recharts' default
            // tooltip, which showed the raw data key ("netWorth : ...") and
            // fell back to a numeric point index for the label since this
            // compact chart has no XAxis to derive a real date label from.
            return (
              <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-card">
                <p className="text-muted-foreground">{point.date}</p>
                <p className="font-medium text-popover-foreground">{formatMoney(point.netWorth)}</p>
              </div>
            );
          }}
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
  );
}
