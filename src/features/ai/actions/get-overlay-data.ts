"use server";

import { getProfile } from "@/features/profile/queries";
import { canUseFeature, FEATURES } from "@/lib/billing/entitlements";
import { getCompanionState } from "@/features/companions/queries";
import { buildCompanionTip } from "@/features/companions/tip-builder";
import { getCompanionFinancialDataLocked } from "@/features/companions/privacy";

export interface AiOverlayData {
  displayName: string | null;
  historyEnabled: boolean;
  /**
   * The active companion's one real-data line for its greeting, or null
   * when there's genuinely nothing to raise (the greeting then uses the
   * companion's own default line).
   */
  greetingTip: string | null;
}

/**
 * Feeds the floating AI overlay (AiAssistantPanel) as a callable Server
 * Action — the overlay is mounted on every authenticated page but only
 * needs this once actually opened.
 *
 * 2026-10-04 simplification: the overlay is now chat-only (the Summary /
 * Analyze / Tools tabs duplicated the dashboard and the bottom nav), so the
 * snapshot, insights and health check it used to fetch for those tabs are
 * gone; the companion's greeting carries one real fact instead.
 *
 * Deliberately does NOT restore the latest conversation (unlike /ai): the
 * overlay always opens on its greeting + suggestions. Past conversations
 * stay reachable via /ai and, for Plus+, the history panel.
 */
export async function getAiOverlayData(): Promise<AiOverlayData> {
  const [profile, historyEnabled, companion, privacyLocked] = await Promise.all([
    getProfile(),
    canUseFeature(FEATURES.AI_CHAT_HISTORY),
    getCompanionState(),
    getCompanionFinancialDataLocked(),
  ]);
  const tip = privacyLocked ? null : await buildCompanionTip(companion.active);

  return {
    displayName: profile?.display_name ?? null,
    historyEnabled,
    greetingTip: !tip || tip.allGood ? null : tip.text,
  };
}
