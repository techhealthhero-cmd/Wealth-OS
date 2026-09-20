import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getConversation, getMessages } from "@/features/ai/queries";
import { requireFeature, FEATURES } from "@/lib/billing/entitlements";

/**
 * Loads one past conversation's messages for the Plus+ chat history panel
 * (FEATURES.AI_CHAT_HISTORY). `getConversation`/`getMessages` both take an
 * explicit `userId` and check it (not just RLS) since `id` here is
 * client-supplied — see their own doc comments in features/ai/queries.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await requireFeature(FEATURES.AI_CHAT_HISTORY);
  if (!gate.allowed) return Response.json({ error: "Not available on your plan" }, { status: 403 });

  const conversation = await getConversation(id, user.id);
  if (!conversation) return Response.json({ error: "Not found" }, { status: 404 });

  const messages = await getMessages(id, user.id);
  return Response.json({ conversation, messages });
}
