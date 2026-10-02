import "server-only";

import type { AIMessage } from "@/features/ai/types";

export interface GenerateParams {
  system: string;
  messages: AIMessage[];
  maxTokens?: number;
  /**
   * "off" for short extraction/classification calls. Newer models think
   * before answering by default, and thinking tokens come out of the SAME
   * max_tokens budget — with a small budget the visible answer was cut off
   * mid-JSON (found by evals/capture-ai.eval.ts: a 20-item recap lost its
   * last 8 categories). Omit to keep the model's default (coaching).
   */
  thinking?: "off";
  /**
   * Prompt caching. `cacheablePrefix`: the leading part of `system` that is
   * identical on every request (e.g. the Coach's instructions) — cached so
   * repeat requests re-read it cheaply instead of paying for it in full.
   * `cacheConversation`: also cache everything before the newest message,
   * so a back-and-forth chat doesn't re-pay for its whole history each turn.
   * Pure cost/latency optimisations — the model sees exactly the same input.
   */
  cacheablePrefix?: string;
  cacheConversation?: boolean;
}

const EPHEMERAL = { type: "ephemeral" } as const;

/** The system prompt, split into a cached stable prefix + the rest when a prefix is given. */
function buildSystem(params: GenerateParams): string | { type: "text"; text: string; cache_control?: typeof EPHEMERAL }[] {
  const prefix = params.cacheablePrefix;
  if (!prefix || !params.system.startsWith(prefix) || params.system.length === prefix.length) return params.system;
  return [
    { type: "text", text: prefix, cache_control: EPHEMERAL },
    { type: "text", text: params.system.slice(prefix.length) },
  ];
}

/** Messages, with a cache breakpoint on the one before the newest when asked. */
function buildMessages(params: GenerateParams): { role: string; content: unknown }[] {
  const messages = params.messages.filter((m) => m.role !== "system").map(toAnthropicMessage);
  if (!params.cacheConversation || messages.length < 2) return messages;
  const at = messages.length - 2;
  const target = messages[at];
  const blocks = typeof target.content === "string" ? [{ type: "text", text: target.content }] : (target.content as Record<string, unknown>[]);
  if (blocks.length === 0) return messages;
  const last = { ...blocks[blocks.length - 1], cache_control: EPHEMERAL };
  messages[at] = { role: target.role, content: [...blocks.slice(0, -1), last] };
  return messages;
}

/**
 * Anthropic's Messages API accepts `content` as either a plain string or an
 * array of content blocks (image + text mixed). Only build the array form
 * when a message actually has an image attached — every existing text-only
 * call site is unaffected (still sends a plain string, byte-for-byte the
 * same request shape as before image support existed).
 */
function toAnthropicMessage(m: AIMessage): { role: string; content: unknown } {
  if (!m.images?.length) return { role: m.role, content: m.content };

  return {
    role: m.role,
    content: [
      ...m.images.map((img) => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64Data },
      })),
      { type: "text", text: m.content },
    ],
  };
}

export interface GenerateResult {
  content: string;
  /** inputTokens = uncached input only; cache reads/writes are reported separately. */
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number };
  model: string;
  /** "max_tokens" = the answer was cut off by the output budget. */
  stopReason?: string;
}

/**
 * Provider-agnostic AI abstraction. Every AI call in this app goes through
 * an implementation of this interface — nothing calls a provider's SDK or
 * REST API directly from a component, action, or route handler. Swapping
 * providers (or adding a second one) means writing one new class here, not
 * touching any calling code.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
  /** Yields text chunks as they arrive; the final `return` value is the same shape as generate()'s result. */
  stream(params: GenerateParams): AsyncGenerator<string, GenerateResult, void>;
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";
// One model for every task. The Thai capture eval (evals/capture-ai.eval.ts,
// 2026-10-03) compared it with Haiku 4.5 on the capture helpers: with
// thinking off, Sonnet was 98% / 100% vs Haiku's 90% / 80% (categories /
// sentence reading) at about the same speed — not worth a second model.
// 1024 was found live (Day 6 pre-flight AI verification) to truncate normal
// coaching answers mid-sentence/mid-word — a broad question like "how are my
// finances and what should I do first" routinely needs more than 1024 output
// tokens once it covers income/expenses/net worth/debt/priority in Thai.
const DEFAULT_MAX_TOKENS = 2048;
// Day 8 STEP 14: a hung upstream request must not hang this app's request
// indefinitely (and on a serverless host, would otherwise run until the
// platform's own execution-time limit kills it uncleanly). No retry is
// added alongside this — retrying a request that already reached Anthropic
// risks generating and billing a second response for one user message.
const REQUEST_TIMEOUT_MS = 30_000;
// Streaming needs more headroom than a single non-streaming call: the
// timeout covers the entire response. Measured 2026-10-03: ~85 output
// tokens/s, so a full COACH_MAX_TOKENS reply needs ~50s — 90s leaves room.
const STREAM_TIMEOUT_MS = 90_000;

/**
 * Direct `fetch` against the Anthropic Messages API — no SDK dependency,
 * consistent with this project's existing pattern of calling external HTTP
 * APIs directly (e.g. the Supabase Management API calls used to apply
 * migrations). Never imported into client code: this whole module is
 * `server-only`, and the API key never leaves the server.
 */
class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private buildBody(params: GenerateParams, stream: boolean) {
    return {
      model: this.model,
      max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: buildSystem(params),
      messages: buildMessages(params),
      stream,
      ...(params.thinking === "off" ? { thinking: { type: "disabled" } } : {}),
    };
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(this.buildBody(params, false)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`Anthropic API error (${res.status}): ${errorBody.slice(0, 500)}`);
    }

    const data = await res.json();
    const content = (data.content ?? [])
      .filter((block: { type: string }) => block.type === "text")
      .map((block: { text: string }) => block.text)
      .join("");

    return {
      content,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        cacheReadTokens: data.usage?.cache_read_input_tokens ?? 0,
        cacheWriteTokens: data.usage?.cache_creation_input_tokens ?? 0,
      },
      model: this.model,
      stopReason: data.stop_reason,
    };
  }

  async *stream(params: GenerateParams): AsyncGenerator<string, GenerateResult, void> {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(this.buildBody(params, true)),
      signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
    });

    if (!res.ok || !res.body) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`Anthropic API error (${res.status}): ${errorBody.slice(0, 500)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;
    let stopReason: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        if (event.type === "content_block_delta") {
          const delta = event.delta as { type: string; text?: string } | undefined;
          if (delta?.type === "text_delta" && delta.text) {
            fullText += delta.text;
            yield delta.text;
          }
        } else if (event.type === "message_start") {
          const usage = (
            event.message as
              | { usage?: { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } }
              | undefined
          )?.usage;
          inputTokens = usage?.input_tokens ?? 0;
          cacheReadTokens = usage?.cache_read_input_tokens ?? 0;
          cacheWriteTokens = usage?.cache_creation_input_tokens ?? 0;
        } else if (event.type === "message_delta") {
          const usage = event.usage as { output_tokens?: number } | undefined;
          outputTokens = usage?.output_tokens ?? outputTokens;
          stopReason = (event.delta as { stop_reason?: string } | undefined)?.stop_reason ?? stopReason;
        }
      }
    }

    return { content: fullText, usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }, model: this.model, stopReason };
  }
}

let cachedProvider: AIProvider | null | undefined;

/**
 * Returns null (never throws) when AI isn't configured — every caller must
 * handle that as a real, expected state ("AI coach unavailable"), not an
 * error to crash on. `AI_API_KEY`/`AI_MODEL` are optional server env vars
 * (see src/config/env.ts).
 */
export function getAIProvider(): AIProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    cachedProvider = null;
    return null;
  }

  const model = process.env.AI_MODEL || DEFAULT_MODEL;
  cachedProvider = new AnthropicProvider(apiKey, model);
  return cachedProvider;
}

/** A provider pinned to one model — for offline evals comparing models, never request handling. */
export function createAIProviderForModel(apiKey: string, model: string): AIProvider {
  return new AnthropicProvider(apiKey, model);
}

/** Test-only: overrides the cached provider (e.g. with a mock) or clears it. */
export function __setProviderForTesting(provider: AIProvider | null | undefined) {
  cachedProvider = provider;
}
