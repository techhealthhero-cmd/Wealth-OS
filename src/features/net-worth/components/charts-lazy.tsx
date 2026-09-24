"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Perf audit finding: net-worth-view.tsx statically imported Recharts,
 * unlike every dashboard chart (see
 * src/features/dashboard/components/charts-lazy.tsx, which this mirrors) —
 * that file's own doc comment already named this as a deferred gap, since
 * net-worth-view.tsx mixes chart and non-chart UI in one component. Fixed
 * by extracting just the chart into net-worth-history-chart.tsx and lazy-
 * loading it here instead.
 */
export const NetWorthHistoryChart = dynamic(
  () => import("./net-worth-history-chart").then((mod) => mod.NetWorthHistoryChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] w-full rounded-lg" />,
  }
);
