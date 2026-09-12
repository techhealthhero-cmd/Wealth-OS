import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __setProviderForTesting, getAIProvider, type AIProvider } from "@/features/ai/lib/provider";

const ORIGINAL_ENV = { ...process.env };

describe("getAIProvider — fallback/error handling", () => {
  beforeEach(() => {
    __setProviderForTesting(undefined);
  });

  afterEach(() => {
    __setProviderForTesting(undefined);
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns null (never throws) when AI_API_KEY is not configured", () => {
    delete process.env.AI_API_KEY;
    expect(getAIProvider()).toBeNull();
  });

  it("returns a provider once AI_API_KEY is set", () => {
    process.env.AI_API_KEY = "test-key";
    const provider = getAIProvider();
    expect(provider).not.toBeNull();
    expect(provider?.name).toBe("anthropic");
  });

  it("lets tests inject a mock provider instead of hitting a real API", async () => {
    const mockProvider: AIProvider = {
      name: "mock",
      model: "mock-model",
      generate: vi.fn().mockResolvedValue({ content: "hello", usage: { inputTokens: 1, outputTokens: 1 }, model: "mock-model" }),
      async *stream() {
        yield "hel";
        yield "lo";
        return { content: "hello", usage: { inputTokens: 1, outputTokens: 1 }, model: "mock-model" };
      },
    };

    __setProviderForTesting(mockProvider);
    expect(getAIProvider()).toBe(mockProvider);

    const result = await getAIProvider()?.generate({ system: "sys", messages: [] });
    expect(result?.content).toBe("hello");
  });
});

describe("AnthropicProvider.stream — SSE parsing", () => {
  beforeEach(() => {
    __setProviderForTesting(undefined);
    process.env.AI_API_KEY = "test-key";
    process.env.AI_MODEL = "claude-sonnet-5";
  });

  afterEach(() => {
    __setProviderForTesting(undefined);
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  function sseResponse(lines: string[]): Response {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const line of lines) controller.enqueue(encoder.encode(line));
        controller.close();
      },
    });
    return new Response(body, { status: 200 });
  }

  it("yields text deltas in order and returns aggregated usage", async () => {
    const events = [
      `data: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 42 } } })}\n\n`,
      `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "สวัสดี" } })}\n\n`,
      `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "ครับ" } })}\n\n`,
      `data: ${JSON.stringify({ type: "message_delta", usage: { output_tokens: 7 } })}\n\n`,
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(events)));

    const provider = getAIProvider();
    expect(provider).not.toBeNull();

    const chunks: string[] = [];
    const generator = provider!.stream({ system: "sys", messages: [{ role: "user", content: "hi" }] });
    let step = await generator.next();
    while (!step.done) {
      chunks.push(step.value);
      step = await generator.next();
    }

    expect(chunks.join("")).toBe("สวัสดีครับ");
    expect(step.value.content).toBe("สวัสดีครับ");
    expect(step.value.usage).toEqual({ inputTokens: 42, outputTokens: 7 });
  });

  it("throws a descriptive error when the API responds with a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }))
    );

    const provider = getAIProvider();
    const generator = provider!.stream({ system: "sys", messages: [] });
    await expect(generator.next()).rejects.toThrow(/Anthropic API error \(429\)/);
  });
});
