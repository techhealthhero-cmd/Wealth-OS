"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Day 8 STEP 7 performance audit finding: Recharts (a genuinely large
 * dependency) was being bundled directly into the dashboard's initial
 * client JS via a plain static import — the highest-traffic page in the
 * app, loading a charting library before the user has even scrolled to see
 * a chart. `next/dynamic` with `ssr: false` code-splits it into its own
 * chunk, fetched only once this component actually mounts.
 *
 * `ssr: false` needs a Client Component boundary (`next/dynamic` refuses it
 * inside a Server Component) — this file exists purely to be that
 * boundary, so `dashboard/page.tsx` (a Server Component) can still import
 * from here with a plain static import and get the lazy behavior for free.
 *
 * `forecast-view.tsx`/`net-worth-view.tsx` also use Recharts — each has its
 * own sibling `charts-lazy.tsx` (in `features/forecast/components/` and
 * `features/net-worth/components/` respectively) following this exact same
 * pattern, since extracting their chart-only subcomponent first meant they
 * couldn't share this file directly.
 */
const ChartSkeleton = () => <Skeleton className="h-[240px] w-full rounded-lg" />;

export const IncomeVsExpenseChart = dynamic(() => import("./charts").then((mod) => mod.IncomeVsExpenseChart), {
  ssr: false,
  loading: ChartSkeleton,
});

export const SpendingByCategoryChart = dynamic(() => import("./charts").then((mod) => mod.SpendingByCategoryChart), {
  ssr: false,
  loading: ChartSkeleton,
});
