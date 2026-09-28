"use server";

import { getProfile } from "@/features/profile/queries";
import { getFinancialSummary, getFinancialPriority } from "@/features/ai/tools";
import { getVisibleInsights } from "@/features/ai/lib/insights";
import { buildMonthlyHealthCheck } from "@/features/ai/lib/health-check";
import { canUseFeature, FEATURES } from "@/lib/billing/entitlements";
import type { FinancialSnapshotTool, PriorityTool } from "@/features/ai/types";
import type { Insight } from "@/features/ai/lib/insights";
import type { MonthlyHealthCheck } from "@/features/ai/lib/health-check";

export interface AiOverlayData {
  displayName: string | null;
  historyEnabled: boolean;
  snapshot: FinancialSnapshotTool;
  priority: PriorityTool | null;
  insights: Insight[];
  healthCheck: MonthlyHealthCheck;
}

/**
 * Feeds the floating AI overlay (AiAssistantPanel) — the same data the full
 * /ai page already builds server-side in its own render (snapshot,
 * priority, insights, health check, history entitlement), but as a callable
 * Server Action instead: the overlay is mounted from FloatingAiButton
 * (rendered on every authenticated page via (app)/layout.tsx) and only needs
 * this once actually opened, not on every page load — fetching it eagerly in
 * the layout for a widget most page views never open would cost every
 * request several extra queries for nothing.
 *
 * Deliberately does NOT restore the latest conversation (unlike /ai):
 * requested that the overlay always opens on its greeting + quick-action
 * start screen. Past conversations stay reachable via /ai and, for Plus+,
 * the history panel once a chat is underway.
 */
export async function getAiOverlayData(): Promise<AiOverlayData> {
  const [profile, snapshot, priority, insights, healthCheck, historyEnabled] = await Promise.all([
    getProfile(),
    getFinancialSummary(),
    getFinancialPriority(),
    getVisibleInsights(),
    buildMonthlyHealthCheck(),
    canUseFeature(FEATURES.AI_CHAT_HISTORY),
  ]);

  return {
    displayName: profile?.display_name ?? null,
    historyEnabled,
    snapshot,
    priority,
    insights,
    healthCheck,
  };
}
