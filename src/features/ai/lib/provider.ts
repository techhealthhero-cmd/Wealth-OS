import "server-only";

import type { AIMessage } from "@/features/ai/types";

export interface GenerateParams {
  system: string;
  messages: AIMessage[];
  maxTokens?: number;
}

export interface GenerateResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
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
const DEFAULT_MAX_TOKENS = 1024;

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
      system: params.system,
      messages: params.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
      stream,
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
      },
      model: this.model,
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
          const usage = (event.message as { usage?: { input_tokens?: number } } | undefined)?.usage;
          inputTokens = usage?.input_tokens ?? 0;
        } else if (event.type === "message_delta") {
          const usage = event.usage as { output_tokens?: number } | undefined;
          outputTokens = usage?.output_tokens ?? outputTokens;
        }
      }
    }

    return { content: fullText, usage: { inputTokens, outputTokens }, model: this.model };
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

/** Test-only: overrides the cached provider (e.g. with a mock) or clears it. */
export function __setProviderForTesting(provider: AIProvider | null | undefined) {
  cachedProvider = provider;
}
