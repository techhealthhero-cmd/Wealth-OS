import { afterEach, describe, expect, it, vi } from "vitest";

import { createAIProviderForModel } from "@/features/ai/lib/provider";

/**
 * Short extraction calls turn thinking off: thinking tokens share the
 * max_tokens budget, and left on they cut the visible JSON short.
 */
function mockFetch() {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ content: [{ type: "text", text: "[]" }], usage: { input_tokens: 1, output_tokens: 1 } }), {
        status: 200,
      });
    })
  );
  return bodies;
}

afterEach(() => vi.unstubAllGlobals());

describe("AI provider — thinking control", () => {
  it('sends thinking: disabled only when the call asks for thinking: "off"', async () => {
    const bodies = mockFetch();
    const provider = createAIProviderForModel("test-key", "claude-sonnet-5");
    await provider.generate({ system: "s", maxTokens: 300, thinking: "off", messages: [{ role: "user", content: "x" }] });
    await provider.generate({ system: "s", messages: [{ role: "user", content: "x" }] });
    expect(bodies[0]).toMatchObject({ thinking: { type: "disabled" }, max_tokens: 300 });
    expect(bodies[1]).not.toHaveProperty("thinking");
  });
});

describe("AI provider — prompt caching", () => {
  it("splits the system prompt into a cached stable prefix + the changing rest", async () => {
    const bodies = mockFetch();
    const provider = createAIProviderForModel("test-key", "claude-sonnet-5");
    await provider.generate({ system: "RULES\n\nCONTEXT", cacheablePrefix: "RULES", messages: [{ role: "user", content: "x" }] });
    expect(bodies[0].system).toEqual([
      { type: "text", text: "RULES", cache_control: { type: "ephemeral" } },
      { type: "text", text: "\n\nCONTEXT" },
    ]);
  });

  it("ignores a prefix that doesn't match, and keeps a plain string when no prefix is given", async () => {
    const bodies = mockFetch();
    const provider = createAIProviderForModel("test-key", "claude-sonnet-5");
    await provider.generate({ system: "OTHER", cacheablePrefix: "RULES", messages: [{ role: "user", content: "x" }] });
    await provider.generate({ system: "PLAIN", messages: [{ role: "user", content: "x" }] });
    expect(bodies[0].system).toBe("OTHER");
    expect(bodies[1].system).toBe("PLAIN");
  });

  it("caches the conversation up to (not including) the newest message", async () => {
    const bodies = mockFetch();
    const provider = createAIProviderForModel("test-key", "claude-sonnet-5");
    await provider.generate({
      system: "s",
      cacheConversation: true,
      messages: [
        { role: "user", content: "q1" },
        { role: "assistant", content: "a1" },
        { role: "user", content: "q2" },
      ],
    });
    const messages = bodies[0].messages as { role: string; content: unknown }[];
    expect(messages[0].content).toBe("q1");
    expect(messages[1].content).toEqual([{ type: "text", text: "a1", cache_control: { type: "ephemeral" } }]);
    expect(messages[2].content).toBe("q2");
  });
});
