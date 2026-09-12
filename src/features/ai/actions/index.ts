import "server-only";

import { createClient } from "@/lib/supabase/server";

const TITLE_MAX_LENGTH = 60;

/** Derives a conversation title from the user's first message — no extra AI call for this. */
export function deriveConversationTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().replace(/\s+/g, " ");
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, TITLE_MAX_LENGTH - 1)}…`;
}

export async function createConversation(userId: string, title: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title })
    .select("id")
    .single();
  if (error) throw new Error("Failed to create conversation");
  return data.id;
}

export async function touchConversation(conversationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}

export async function appendMessage(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("ai_messages").insert({
    user_id: userId,
    conversation_id: conversationId,
    role,
    content,
  });
  if (error) throw new Error("Failed to save message");
}

export async function logUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("ai_usage_log").insert({
    user_id: userId,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });
}
