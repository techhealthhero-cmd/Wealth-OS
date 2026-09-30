"use client";

import dynamic from "next/dynamic";

import { RouteLoadingSkeleton } from "@/components/shared/route-loading-skeleton";

/** Client-only: the flow restores its draft from localStorage in its initial state. */
export const DiagnosticFlowLoader = dynamic(() => import("./diagnostic-flow"), {
  ssr: false,
  loading: () => <RouteLoadingSkeleton rows={3} />,
});
