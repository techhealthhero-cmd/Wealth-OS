import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getConversations, searchMessages } from "@/features/ai/queries";
import { requireFeature, FEATURES } from "@/lib/billing/entitlements";

/**
 * Plus+-only AI chat history/search (FEATURES.AI_CHAT_HISTORY). Gated
 * server-side before any data fetch, same as every other `requireFeature()`
 * route in this app (see api/export/transactions/route.ts). `?q=` present
 * -> search message content (searchMessages, migration 0016's trigram
 * index); otherwise -> list conversations (getConversations, already
 * user-scoped via RLS).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await requireFeature(FEATURES.AI_CHAT_HISTORY);
  if (!gate.allowed) return Response.json({ error: "Not available on your plan" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim();

  if (q) {
    const hits = await searchMessages(user.id, q);
    return Response.json({ hits });
  }

  const conversations = await getConversations();
  return Response.json({ conversations });
}
