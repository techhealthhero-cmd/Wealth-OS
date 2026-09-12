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

export async function getConversation(id: string): Promise<AIConversation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_conversations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Failed to load conversation");
  return data;
}

/** Oldest-first, for chronological chat rendering. */
export async function getMessages(conversationId: string): Promise<AIMessageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Failed to load messages");
  return data ?? [];
}
