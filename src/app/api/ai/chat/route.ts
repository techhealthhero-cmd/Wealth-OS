import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { buildFinancialContext } from "@/features/ai/lib/context-builder";
import { buildSystemPrompt } from "@/features/ai/prompts/money-coach";
import { getAIProvider } from "@/features/ai/lib/provider";
import {
  containsDistressSignal,
  requestsGuaranteedReturns,
  validateImageAttachment,
  validateUserMessage,
} from "@/features/ai/lib/guardrails";
import { getConversation, getMessages } from "@/features/ai/queries";
import { appendMessage, createConversation, deriveConversationTitle, logUsage, touchConversation } from "@/features/ai/actions";
import { getAIUsageStatus } from "@/lib/billing/ai-usage";
import { captureError } from "@/lib/observability";
import { trackEvent } from "@/lib/analytics";
import { checkRateLimit } from "@/lib/rate-limit";
import type { AIImageMediaType, AIMessage, AIMessageImage } from "@/features/ai/types";

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
  const requestedConversationId = typeof body?.conversationId === "string" ? body.conversationId : null;

  // Optional single-image attachment (a screenshot the user wants explained
  // — e.g. "what does this form field mean?"). Never persisted to
  // ai_messages (see appendMessage calls below) — used only for this one
  // turn's request to the provider, so a possibly-sensitive screenshot
  // doesn't sit in the database indefinitely. Untrusted client input:
  // validated for type/size before it ever reaches the provider.
  const rawImage = body?.image;
  let image: AIMessageImage | null = null;
  if (rawImage && typeof rawImage.mediaType === "string" && typeof rawImage.base64Data === "string") {
    const imageValidation = validateImageAttachment(rawImage.mediaType, rawImage.base64Data);
    if (!imageValidation.valid) {
      const error =
        imageValidation.reason === "too_large" ? dict.aiCoach.errorImageTooLarge : dict.aiCoach.errorImageUnsupportedType;
      return Response.json({ error }, { status: 400 });
    }
    image = { mediaType: rawImage.mediaType as AIImageMediaType, base64Data: rawImage.base64Data };
  }
  // A conversation id here comes straight from the client request body, so
  // it's untrusted input — verify it's actually this user's own
  // conversation before it's used for anything (history lookup, appending
  // messages, or touching updated_at). Anything else (someone else's id, a
  // stale/deleted id) is treated exactly like "no id" and a fresh
  // conversation gets created below, rather than silently trusting it.
  const conversationId = requestedConversationId
    ? (await getConversation(requestedConversationId, user.id))
      ? requestedConversationId
      : null
    : null;

  // An image attached with no typed question ("just look at this") is a
  // real, expected case for this feature — substitute a default question
  // before the usual empty-message rejection, rather than forcing the
  // client to fabricate placeholder text itself.
  const effectiveMessage = !message.trim() && image ? dict.aiCoach.imageOnlyDefaultPrompt : message;

  const validation = validateUserMessage(effectiveMessage);
  if (!validation.valid) {
    const error = validation.reason === "empty" ? dict.aiCoach.errorEmpty : dict.aiCoach.errorTooLong;
    return Response.json({ error }, { status: 400 });
  }
  const trimmedMessage = effectiveMessage.trim();

  // Acute personal crisis takes priority over money coaching — short-circuit
  // before any AI call and point to real help instead.
  if (containsDistressSignal(trimmedMessage)) {
    const reply = dict.aiCoach.distressNotice;
    const finalConversationId = conversationId ?? (await createConversation(user.id, deriveConversationTitle(trimmedMessage)));
    await appendMessage(user.id, finalConversationId, "user", trimmedMessage);
    await appendMessage(user.id, finalConversationId, "assistant", reply);
    await touchConversation(finalConversationId, user.id);
    return Response.json({ conversationId: finalConversationId, reply });
  }

  // Day 8 STEP 12: burst/abuse protection, distinct from the Day 7 monthly
  // plan quota below — this catches a rapid-fire script hammering the
  // endpoint well before it would ever hit its monthly message limit.
  const burstLimit = await checkRateLimit(`ai-chat:user:${user.id}`, { windowSeconds: 60, maxRequests: 15 });
  if (!burstLimit.allowed) {
    return Response.json({ error: dict.aiCoach.errorGeneric }, { status: 429 });
  }

  // STEP 6 (Day 7): authenticate (done above) -> resolve plan + check usage
  // -> reject cleanly if the limit is reached -> otherwise call the
  // provider -> write the usage log (below, after a successful reply). The
  // distress short-circuit above is exempt: it never calls the provider and
  // costs no tokens, so it must never be blocked by a message quota.
  const usage = await getAIUsageStatus(user.id);
  if (usage.limitReached) {
    return Response.json(
      {
        error: `${dict.aiCoach.limitReachedMessage} ${dict.aiCoach.limitReachedReset} ${usage.resetDate}`,
        limitReached: true,
        resetDate: usage.resetDate,
        upgradeUrl: "/pricing",
      },
      { status: 403 }
    );
  }

  const provider = getAIProvider();
  if (!provider) {
    return Response.json({ error: dict.aiCoach.notConfigured }, { status: 503 });
  }

  const [context, history] = await Promise.all([
    buildFinancialContext(),
    conversationId ? getMessages(conversationId, user.id) : Promise.resolve([]),
  ]);

  let system = buildSystemPrompt(context);
  if (requestsGuaranteedReturns(trimmedMessage)) {
    system +=
      "\n\nThe user's latest message appears to be asking for a guaranteed return or guaranteed profit. Firmly and clearly reiterate that no investment return can ever be guaranteed, without being preachy about it.";
  }

  const conversationMessages: AIMessage[] = [
    ...history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: trimmedMessage, images: image ? [image] : undefined },
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
        await touchConversation(finalConversationId, user.id);
        await logUsage(user.id, final.model, final.usage.inputTokens, final.usage.outputTokens);
        // `usage` was resolved before this request's own reply was logged,
        // so 0 here means this is genuinely the first logged message of the
        // user's current billing period — a reasonable, free proxy for
        // "first AI message ever" for the overwhelming majority of users
        // (their signup month), without a second lifetime-count query.
        if (usage.used === 0) trackEvent("first_ai_message_sent", user.id);
        send(controller, { type: "done" });
      } catch (error) {
        captureError(error, { route: "api/ai/chat", provider: provider.name, operation: "stream", userId: user.id });
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
