import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeAdminClient, type FakeDb } from "./mocks/fake-admin-client";
import { GET } from "@/app/api/cron/ai-checkin/route";

/**
 * Mocked-integration test for /api/cron/ai-checkin — exercises the route's
 * OWN orchestration logic (auth, plan-eligibility filtering, dedupe,
 * opt-out, the hasEnoughData skip-without-burning-the-key rule, quota
 * exclusion) against an in-memory fake admin client, same style as
 * billing-webhook-route.test.ts. The actual financial data-gathering
 * (health-check-for-user.ts, which would need transactions/budgets/
 * accounts/assets/liabilities/net_worth_snapshots tables) and the real
 * Claude call are mocked out at the module level — this test's job is the
 * route's own decision logic, not re-testing computeMonthlyHealthCheck()
 * (already covered by tests/ai-health-check.test.ts) or the AI provider.
 *
 * A static top-level `import { GET }` is used for every test except the
 * one that needs CRON_SECRET actually unset (see that test) —
 * getServerEnv() caches its parsed result at module-load time, so
 * deleting the env var later wouldn't be seen without re-importing after
 * vi.resetModules(). That reset+dynamic-import pattern is real overhead
 * (found live: doing it in every test's beforeEach caused the earlier
 * tests in this file to exceed the default 5s timeout under full-suite
 * load, not a logic bug), so it's confined to just the one test that
 * actually needs it.
 */

let db: FakeDb;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createFakeAdminClient(db),
}));

let healthCheckResult: { hasEnoughData: boolean; overallStatus: string; positives: unknown[]; risks: unknown[]; changes: unknown[]; priorityAction: null };
const buildMonthlyHealthCheckForUser = vi.fn(async () => healthCheckResult);
vi.mock("@/features/ai/lib/health-check-for-user", () => ({
  buildMonthlyHealthCheckForUser: () => buildMonthlyHealthCheckForUser(),
}));

const generateMock = vi.fn(async () => ({ content: "สรุปให้แล้วนะ", usage: { inputTokens: 10, outputTokens: 10 }, model: "test" }));
vi.mock("@/features/ai/lib/provider", () => ({
  getAIProvider: () => ({ name: "fake", model: "test", generate: generateMock, stream: vi.fn() }),
}));

const ORIGINAL_ENV = { ...process.env };
const SECRET = "test-cron-secret";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function callRoute(authHeader: string | null = `Bearer ${SECRET}`) {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  const request = new Request("http://localhost/api/cron/ai-checkin", { headers });
  return GET(request);
}

function seedProUser(userId: string, overrides: Record<string, unknown> = {}) {
  db.subscriptions.push({
    id: `sub-${userId}`,
    user_id: userId,
    plan: "pro",
    status: "active",
    ...overrides,
  });
  db.profiles.push({ user_id: userId, preferred_language: "th" });
}

describe("/api/cron/ai-checkin — integration (mocked admin client + AI provider)", () => {
  beforeEach(() => {
    db = { subscriptions: [], financial_notifications: [], notification_preferences: [], profiles: [], ai_conversations: [], ai_messages: [] };
    healthCheckResult = { hasEnoughData: true, overallStatus: "good", positives: [], risks: [], changes: [], priorityAction: null };
    generateMock.mockClear();
    buildMonthlyHealthCheckForUser.mockClear();
    // getServerEnv() Zod-validates the full server env schema, not just
    // CRON_SECRET — this worker process doesn't otherwise have these set
    // (real values come from .env.local outside tests).
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://fake-test-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "fake-anon-key";
    process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("rejects a request with no/wrong Authorization header", async () => {
    const res = await callRoute(null);
    expect(res.status).toBe(401);

    const res2 = await callRoute("Bearer wrong-secret");
    expect(res2.status).toBe(401);
  });

  it("rejects every request when CRON_SECRET isn't configured, never treats unset as 'skip the check'", async () => {
    // getServerEnv() caches its parsed env at module-load time (same
    // singleton behavior it has in production) — the static top-level
    // `GET` import above already has CRON_SECRET baked in from whatever
    // was set when this test file's modules first loaded. Deleting it now
    // and re-importing after vi.resetModules() is what actually exercises
    // "unset" rather than "set to the same value as every other test".
    delete process.env.CRON_SECRET;
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://fake-test-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "fake-anon-key";
    process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
    const { GET: freshGet } = await import("@/app/api/cron/ai-checkin/route");
    const request = new Request("http://localhost/api/cron/ai-checkin", { headers: { authorization: `Bearer ${SECRET}` } });
    const res = await freshGet(request);
    expect(res.status).toBe(401);
  }, 15000);

  it("processes an eligible Pro user: creates a conversation+message and a dedupe-keyed notification", async () => {
    seedProUser("user-1");
    const res = await callRoute();
    const body = await res.json();

    expect(body).toEqual({ processed: 1, skipped: 0, failed: 0 });
    expect(db.ai_conversations).toHaveLength(1);
    expect(db.ai_messages).toHaveLength(1);
    expect(db.ai_messages[0]).toMatchObject({ user_id: "user-1", role: "assistant", content: "สรุปให้แล้วนะ" });
    expect(db.financial_notifications).toHaveLength(1);
    expect(db.financial_notifications[0]).toMatchObject({
      user_id: "user-1",
      type: "ai_checkin",
      dedupe_key: `ai_checkin:${currentMonthKey()}`,
    });
  });

  it("excludes a Plus (non-Pro) user entirely — aiCheckinsPerMonth is Pro-only", async () => {
    db.subscriptions.push({ id: "sub-2", user_id: "user-2", plan: "plus", status: "active" });
    db.profiles.push({ user_id: "user-2", preferred_language: "th" });

    const res = await callRoute();
    const body = await res.json();

    expect(body).toEqual({ processed: 0, skipped: 0, failed: 0 });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("excludes a Pro user whose subscription status doesn't actually grant entitlement (e.g. canceled)", async () => {
    seedProUser("user-3", { status: "canceled" });
    const res = await callRoute();
    const body = await res.json();
    expect(body).toEqual({ processed: 0, skipped: 0, failed: 0 });
  });

  it("skips a user already sent a check-in this month (dedupe) without calling the AI again", async () => {
    seedProUser("user-4");
    db.financial_notifications.push({
      id: "existing",
      user_id: "user-4",
      type: "ai_checkin",
      dedupe_key: `ai_checkin:${currentMonthKey()}`,
      title: "x",
      body: "x",
    });

    const res = await callRoute();
    const body = await res.json();

    expect(body).toEqual({ processed: 0, skipped: 0, failed: 0 });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("skips a user who opted out via notification_preferences.ai_checkin = false", async () => {
    seedProUser("user-5");
    db.notification_preferences.push({ user_id: "user-5", ai_checkin: false });

    const res = await callRoute();
    const body = await res.json();

    expect(body).toEqual({ processed: 0, skipped: 0, failed: 0 });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("skips (without writing a notification) when hasEnoughData is false, so a retry next period stays possible", async () => {
    seedProUser("user-6");
    healthCheckResult = { hasEnoughData: false, overallStatus: "mixed", positives: [], risks: [], changes: [], priorityAction: null };

    const res = await callRoute();
    const body = await res.json();

    expect(body).toEqual({ processed: 0, skipped: 1, failed: 0 });
    expect(db.financial_notifications).toHaveLength(0);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("continues processing remaining users if one throws, and reports it as failed", async () => {
    seedProUser("user-7");
    seedProUser("user-8");
    buildMonthlyHealthCheckForUser.mockImplementationOnce(async () => {
      throw new Error("boom");
    });

    const res = await callRoute();
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.processed).toBe(1);
  });
});
