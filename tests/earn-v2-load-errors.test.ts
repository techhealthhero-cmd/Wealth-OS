import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Earn V2 audit P1-1: a database failure must never look like "no data"
 * (which would show the first-time intro to a returning user). Queries
 * throw to the Earn error boundary; only "relation does not exist yet"
 * (migration not applied) degrades to "not available".
 */

let failTable: string | null;
let failCode: string;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const res = () =>
        table === failTable ? { data: null, error: { code: failCode, message: "boom" } } : { data: table === "income_paths" ? [] : null, error: null };
      const q = {
        select: () => q, eq: () => q, neq: () => q, in: () => q, order: () => q, limit: () => q,
        maybeSingle: async () => res(),
        then: (f: (r: unknown) => unknown) => Promise.resolve(f(res())),
      };
      return q;
    },
  }),
}));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  failTable = null;
  failCode = "08006";
});

describe("Earn V2 load errors", () => {
  it("no rows → null/empty (genuinely new user)", async () => {
    const q = await import("@/features/earn/v2-queries");
    expect(await q.getLatestAssessment()).toBeNull();
    expect(await q.getIncomePaths()).toEqual([]);
  });

  it.each(["earn_assessments", "income_paths", "emergency_funds"])("a failure reading %s throws instead of pretending the user is new", async (table) => {
    failTable = table;
    const q = await import("@/features/earn/v2-queries");
    await expect(q.getEarnHubData()).rejects.toThrow();
  });

  it("a missing relation (migration not applied) degrades to 'not available', not an error", async () => {
    failTable = "earn_transaction_links";
    failCode = "42P01";
    const q = await import("@/features/earn/v2-queries");
    expect((await q.getLinkedIncome(["p1"])).available).toBe(false);
    failCode = "08006";
    await expect(q.getLinkedIncome(["p1"])).rejects.toThrow();
  });
});

describe("Earn V2 route-level load errors", () => {
  it("mission result distinguishes query failure from not-found", () => {
    const source = readFileSync(resolve("src/app/(app)/earn/missions/[missionId]/result/page.tsx"), "utf8");
    expect(source).toContain("missionError");
    expect(source).toContain("pathError");
    expect(source).toContain("throwDbError");
  });
});
