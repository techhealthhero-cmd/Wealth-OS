import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AIConversation, AIMessageRow } from "@/types/database";
import { throwDbError } from "@/lib/db-error";

/** Newest-first, for a conversation list/sidebar. RLS scopes this to the caller's own rows. */
export async function getConversations(): Promise<AIConversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throwDbError(error, "ai.getConversations", "Failed to load conversations");
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
  if (error) throwDbError(error, "ai.getConversation", "Failed to load conversation");
  return data;
}

const MESSAGES_SAFETY_LIMIT = 200;

/**
 * Oldest-first, for chronological chat rendering. `userId` filtered
 * explicitly for the same reason as `getConversation` above.
 *
 * Perf audit finding: this restored a user's ENTIRE conversation history
 * on every page load, unlike `getConversations()` above it (already capped
 * at `.limit(50)`). Capped to the most recent `MESSAGES_SAFETY_LIMIT`
 * turns — queried newest-first with a limit, then reversed back to
 * chronological order in JS, since a plain ascending `.limit()` would keep
 * the OLDEST messages instead of the most recent ones. A generous ceiling
 * (won't visibly affect any real conversation today), not a full
 * pagination UI — that's a separate, bigger feature for a long-running
 * conversation, this is just a safety net against the unbounded case.
 */
export async function getMessages(conversationId: string, userId: string): Promise<AIMessageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_SAFETY_LIMIT);
  if (error) throwDbError(error, "ai.getMessages", "Failed to load messages");
  return (data ?? []).reverse();
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

export interface AIMessageSearchHit {
  message: AIMessageRow;
  conversationTitle: string | null;
}

/**
 * Plus+ feature (FEATURES.AI_CHAT_HISTORY) — substring search across a
 * user's own message history, backed by the `pg_trgm` GIN index added in
 * migration 0016 (see that file for why trigram `ilike` was chosen over
 * Postgres full-text search: Thai doesn't tokenize well under FTS, and this
 * app's chat content is bilingual). `userId` filtered explicitly — same
 * ownership-check rationale as `getConversation`/`getMessages` above, since
 * this is reachable from a client-supplied search term, not just RLS.
 * `%`/`_` in `term` are escaped so a user's own search text can't widen the
 * match pattern unexpectedly (RLS still scopes rows to the caller either
 * way, so this is a correctness concern for the search results, not a
 * security one).
 */
export async function searchMessages(userId: string, term: string, limit = 30): Promise<AIMessageSearchHit[]> {
  const escaped = term.replace(/[%_]/g, (c) => `\\${c}`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*, ai_conversations!ai_messages_conversation_id_fkey(title)")
    .eq("user_id", userId)
    .ilike("content", `%${escaped}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throwDbError(error, "ai.searchMessages", "Failed to search messages");

  return (data ?? []).map((row) => {
    const { ai_conversations, ...message } = row as AIMessageRow & {
      ai_conversations: { title: string | null } | null;
    };
    return { message: message as AIMessageRow, conversationTitle: ai_conversations?.title ?? null };
  });
}
