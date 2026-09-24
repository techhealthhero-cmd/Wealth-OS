"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Perf audit finding: forecast-view.tsx statically imported Recharts,
 * unlike every dashboard chart (see
 * src/features/dashboard/components/charts-lazy.tsx, which this mirrors) —
 * that file's own doc comment already named this as a deferred gap, since
 * forecast-view.tsx mixes chart and stateful scenario/what-if UI in one
 * component. Fixed by extracting just the chart into forecast-chart.tsx
 * and lazy-loading it here instead.
 */
export const ForecastChart = dynamic(() => import("./forecast-chart").then((mod) => mod.ForecastChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-lg" />,
});
