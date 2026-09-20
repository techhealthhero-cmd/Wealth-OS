import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

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

export async function touchConversation(conversationId: string, userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);
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

/**
 * Admin-client counterparts of createConversation()/appendMessage() above,
 * for the proactive AI check-in cron job (api/cron/ai-checkin/route.ts) —
 * a cron run has no session/cookies for createClient() to read, so it uses
 * the service-role client instead (RLS bypassed; the explicit user_id on
 * each insert is what scopes it, same as every query in
 * health-check-for-user.ts). Deliberately separate functions rather than
 * changing createConversation()/appendMessage() to accept a client
 * parameter — keeps the existing, working interactive-chat call sites in
 * api/ai/chat/route.ts completely untouched.
 *
 * No logUsageAsAdmin(): the check-in's token usage is intentionally never
 * written to ai_usage_log — it shouldn't count against the user's own
 * aiMessagesPerMonth quota (the app messaged them, they didn't spend
 * their own allowance), and aiCheckinsPerMonth's own limit is already
 * enforced by the cron job's dedupe-key check, not by counting rows here.
 */
export async function createConversationAsAdmin(admin: AdminClient, userId: string, title: string): Promise<string> {
  const { data, error } = await admin.from("ai_conversations").insert({ user_id: userId, title }).select("id").single();
  if (error) throw new Error(`Failed to create conversation for cron check-in: ${error.message}`);
  return data.id;
}

export async function appendMessageAsAdmin(
  admin: AdminClient,
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const { error } = await admin.from("ai_messages").insert({
    user_id: userId,
    conversation_id: conversationId,
    role,
    content,
  });
  if (error) throw new Error(`Failed to save message for cron check-in: ${error.message}`);
}
