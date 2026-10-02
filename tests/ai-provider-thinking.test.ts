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
