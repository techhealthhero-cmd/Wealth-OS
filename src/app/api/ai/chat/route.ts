import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { buildFinancialContext } from "@/features/ai/lib/context-builder";
import { buildSystemPrompt } from "@/features/ai/prompts/money-coach";
import { getAIProvider } from "@/features/ai/lib/provider";
import { containsDistressSignal, requestsGuaranteedReturns, validateUserMessage } from "@/features/ai/lib/guardrails";
import { getMessages } from "@/features/ai/queries";
import { appendMessage, createConversation, deriveConversationTitle, logUsage, touchConversation } from "@/features/ai/actions";
import type { AIMessage } from "@/features/ai/types";

const MAX_HISTORY_MESSAGES = 20;

/**
 * Streaming chat endpoint. Emits newline-delimited JSON events rather than
 * raw text so the client can distinguish "new conversation id assigned",
 * "text chunk", and "done"/"error" without a separate SSE parser — the only
 * place that needs actual SSE parsing is `provider.ts`, talking to
 * Anthropic directly.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message : "";
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;

  const validation = validateUserMessage(message);
  if (!validation.valid) {
    const error = validation.reason === "empty" ? dict.aiCoach.errorEmpty : dict.aiCoach.errorTooLong;
    return Response.json({ error }, { status: 400 });
  }
  const trimmedMessage = message.trim();

  // Acute personal crisis takes priority over money coaching — short-circuit
  // before any AI call and point to real help instead.
  if (containsDistressSignal(trimmedMessage)) {
    const reply = dict.aiCoach.distressNotice;
    const finalConversationId = conversationId ?? (await createConversation(user.id, deriveConversationTitle(trimmedMessage)));
    await appendMessage(user.id, finalConversationId, "user", trimmedMessage);
    await appendMessage(user.id, finalConversationId, "assistant", reply);
    await touchConversation(finalConversationId);
    return Response.json({ conversationId: finalConversationId, reply });
  }

  const provider = getAIProvider();
  if (!provider) {
    return Response.json({ error: dict.aiCoach.notConfigured }, { status: 503 });
  }

  const [context, history] = await Promise.all([
    buildFinancialContext(),
    conversationId ? getMessages(conversationId) : Promise.resolve([]),
  ]);

  let system = buildSystemPrompt(context);
  if (requestsGuaranteedReturns(trimmedMessage)) {
    system +=
      "\n\nThe user's latest message appears to be asking for a guaranteed return or guaranteed profit. Firmly and clearly reiterate that no investment return can ever be guaranteed, without being preachy about it.";
  }

  const conversationMessages: AIMessage[] = [
    ...history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: trimmedMessage },
  ];

  const finalConversationId = conversationId ?? (await createConversation(user.id, deriveConversationTitle(trimmedMessage)));
  await appendMessage(user.id, finalConversationId, "user", trimmedMessage);

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: object) => {
    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      send(controller, { type: "conversation", conversationId: finalConversationId });
      try {
        const generator = provider.stream({ system, messages: conversationMessages });
        let result = await generator.next();
        while (!result.done) {
          send(controller, { type: "delta", text: result.value });
          result = await generator.next();
        }
        const final = result.value;
        await appendMessage(user.id, finalConversationId, "assistant", final.content);
        await touchConversation(finalConversationId);
        await logUsage(user.id, final.model, final.usage.inputTokens, final.usage.outputTokens);
        send(controller, { type: "done" });
      } catch {
        send(controller, { type: "error", message: dict.aiCoach.errorGeneric });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
