"use server";

import { getAuthUser } from "@/lib/supabase/server";
import { getLatestConversationWithMessages } from "@/features/ai/queries";
import { canUseFeature, FEATURES } from "@/lib/billing/entitlements";

export interface AiOverlayData {
  initialConversationId: string | undefined;
  initialMessages: { id: string; role: "user" | "assistant"; content: string }[] | undefined;
  historyEnabled: boolean;
}

/**
 * Feeds the floating AI overlay (AiAssistantSheet) — the same initial-state
 * shape the full /ai page already builds server-side in its own render, but
 * as a callable Server Action instead: the overlay is mounted from
 * FloatingAiButton (rendered on every authenticated page via
 * (app)/layout.tsx) and only needs this data once actually opened, not on
 * every page load — fetching it eagerly in the layout for a widget most
 * page views never open would cost every request 2 extra queries for
 * nothing.
 */
export async function getAiOverlayData(): Promise<AiOverlayData> {
  const user = await getAuthUser();
  if (!user) {
    return { initialConversationId: undefined, initialMessages: undefined, historyEnabled: false };
  }

  const [latest, historyEnabled] = await Promise.all([
    getLatestConversationWithMessages(user.id),
    canUseFeature(FEATURES.AI_CHAT_HISTORY),
  ]);

  return {
    initialConversationId: latest?.conversationId,
    initialMessages: latest?.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
    historyEnabled,
  };
}
