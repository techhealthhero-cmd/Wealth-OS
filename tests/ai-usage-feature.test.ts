import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Chat and Quick Capture AI spend separate monthly quotas (migration 0037).
 * A fake ai_usage_log holds rows with a feature; `migrated` switches the
 * column off to prove the pre-0037 fallback (shared count, plain insert).
 */
const state = vi.hoisted(() => ({
  migrated: true,
  rows: [] as { user_id: string; feature?: string }[],
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/billing/entitlements", () => ({
  getEntitlements: async () => ({ limits: { aiMessagesPerMonth: 15, aiCaptureAssistsPerMonth: 60 } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const filters: Record<string, string> = {};
      const query = {
        select: () => query,
        eq(column: string, value: string) {
          filters[column] = value;
          return query;
        },
        gte: () => query,
        lt: () => query,
        then(resolve: (r: unknown) => void) {
          if (filters.feature && !state.migrated) return resolve({ count: null, error: { code: "42703" } });
          const count = state.rows.filter(
            (r) => r.user_id === filters.user_id && (!filters.feature || (r.feature ?? "chat") === filters.feature)
          ).length;
          resolve({ count, error: null });
        },
        insert(row: Record<string, unknown>) {
          if ("feature" in row && !state.migrated) return Promise.resolve({ error: { code: "PGRST204" } });
          state.inserts.push(row);
          return Promise.resolve({ error: null });
        },
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  state.migrated = true;
  state.rows = [];
  state.inserts = [];
});

describe("AI usage quotas — chat vs capture", () => {
  it("capture calls never use up chat messages (and vice versa)", async () => {
    const { getAIUsageStatus, getCaptureAIUsageStatus } = await import("@/lib/billing/ai-usage");
    state.rows = [
      ...Array.from({ length: 20 }, () => ({ user_id: "u1", feature: "capture" })),
      ...Array.from({ length: 3 }, () => ({ user_id: "u1", feature: "chat" })),
      { user_id: "someone-else", feature: "chat" },
    ];
    expect(await getAIUsageStatus("u1")).toMatchObject({ used: 3, limit: 15, remaining: 12, limitReached: false });
    expect(await getCaptureAIUsageStatus("u1")).toMatchObject({ used: 20, limit: 60, remaining: 40, limitReached: false });
  });

  it("records the feature on each call", async () => {
    const { recordAIUsage } = await import("@/lib/billing/ai-usage");
    await recordAIUsage({ userId: "u1", model: "m", inputTokens: 10, outputTokens: 5, feature: "capture" });
    expect(state.inserts).toEqual([{ user_id: "u1", model: "m", input_tokens: 10, output_tokens: 5, feature: "capture" }]);
  });

  it("before migration 0037: counts everything (old shared quota) and still logs", async () => {
    const { getAIUsageStatus, recordAIUsage } = await import("@/lib/billing/ai-usage");
    state.migrated = false;
    state.rows = Array.from({ length: 16 }, () => ({ user_id: "u1" }));
    expect(await getAIUsageStatus("u1")).toMatchObject({ used: 16, limitReached: true });
    await recordAIUsage({ userId: "u1", model: "m", inputTokens: 1, outputTokens: 1, feature: "chat" });
    expect(state.inserts).toEqual([{ user_id: "u1", model: "m", input_tokens: 1, output_tokens: 1 }]);
  });
});
