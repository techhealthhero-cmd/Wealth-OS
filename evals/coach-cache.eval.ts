/**
 * Verifies Coach prompt caching against the real API (costs a few satang):
 * the first request writes the cache, the next one — same instructions,
 * different question — reads it. Run:
 *   npx vitest run --config vitest.eval.config.ts evals/coach-cache.eval.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

import { createAIProviderForModel } from "@/features/ai/lib/provider";
import { buildSystemPromptStablePrefix } from "@/features/ai/prompts/money-coach";

for (const line of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

it.skipIf(!process.env.AI_API_KEY)(
  "Coach instructions and earlier turns are served from cache on the next message",
  async () => {
    const provider = createAIProviderForModel(process.env.AI_API_KEY!, process.env.AI_MODEL || "claude-sonnet-5");
    const prefix = buildSystemPromptStablePrefix("th");
    // A unique context line per run keeps this from reading another run's cache.
    const system = `${prefix}\n\n<financial_context>\nrun ${Date.now()} · รายได้เดือนนี้ ฿35,000 · รายจ่าย ฿28,000\n</financial_context>`;
    const ask = async (messages: { role: "user" | "assistant"; content: string }[]) => {
      const gen = provider.stream({ system, messages, maxTokens: 300, cacheablePrefix: prefix, cacheConversation: true });
      let r = await gen.next();
      while (!r.done) r = await gen.next();
      return r.value;
    };

    const first = await ask([{ role: "user", content: "เดือนนี้เหลือเงินเท่าไหร่" }]);
    const second = await ask([
      { role: "user", content: "เดือนนี้เหลือเงินเท่าไหร่" },
      { role: "assistant", content: first.content },
      { role: "user", content: "ควรเก็บเงินเพิ่มยังไงดี" },
    ]);
    const third = await ask([
      { role: "user", content: "เดือนนี้เหลือเงินเท่าไหร่" },
      { role: "assistant", content: first.content },
      { role: "user", content: "ควรเก็บเงินเพิ่มยังไงดี" },
      { role: "assistant", content: second.content },
      { role: "user", content: "ขอบคุณ" },
    ]);

    mkdirSync("test-results", { recursive: true });
    writeFileSync(
      "test-results/coach-cache-eval.json",
      JSON.stringify({ first: first.usage, second: second.usage, third: third.usage }, null, 2)
    );
    // 1st message writes the cache; later messages read it.
    expect(first.usage.cacheWriteTokens ?? 0).toBeGreaterThan(0);
    expect(second.usage.cacheReadTokens ?? 0).toBeGreaterThan(0);
    expect(third.usage.cacheReadTokens ?? 0).toBeGreaterThan(second.usage.cacheReadTokens ?? 0);
  },
  180_000
);
