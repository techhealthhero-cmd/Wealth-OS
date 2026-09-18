import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AIConversation, AIMessageRow } from "@/types/database";

/** Newest-first, for a conversation list/sidebar. RLS scopes this to the caller's own rows. */
export async function getConversations(): Promise<AIConversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Failed to load conversations");
  return data ?? [];
}

/**
 * `userId` is required and filtered on explicitly — not just left to RLS —
 * specifically because `id` here can originate from a client request body
 * (see `/api/ai/chat`'s `conversationId`), so this doubles as the ownership
 * check that decides whether an attacker-supplied id gets treated as "not
 * found" (same as a real 404) rather than silently trusted.
 */
export async function getConversation(id: string, userId: string): Promise<AIConversation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Failed to load conversation");
  return data;
}

/** Oldest-first, for chronological chat rendering. `userId` filtered explicitly for the same reason as `getConversation` above. */
export async function getMessages(conversationId: string, userId: string): Promise<AIMessageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Failed to load messages");
  return data ?? [];
}

/**
 * Restores the AI Money Coach chat on page load instead of always starting
 * empty — messages are already persisted to `ai_conversations`/`ai_messages`
 * on every turn (see `/api/ai/chat`), but nothing previously read them back,
 * so leaving the page and returning silently lost the visible chat even
 * though the data was never actually gone.
 */
export async function getLatestConversationWithMessages(
  userId: string
): Promise<{ conversationId: string; messages: AIMessageRow[] } | null> {
  const conversations = await getConversations();
  const latest = conversations[0];
  if (!latest) return null;
  const messages = await getMessages(latest.id, userId);
  return { conversationId: latest.id, messages };
}
