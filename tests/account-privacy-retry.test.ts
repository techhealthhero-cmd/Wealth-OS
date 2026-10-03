import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: async () => ({ id: "user-1" }),
  createClient: async () => ({ rpc }),
}));

const okRow = {
  enabled: false,
  protect_accounts: true,
  protect_assets: false,
  protect_overview: false,
  protect_activity: false,
  protect_planning: false,
  protect_insights: false,
  display_style: "blur",
  custom_message: null,
  pin_configured: false,
  is_unlocked: true,
  unlocked_until: null,
  locked_until: null,
};

describe("getAccountPrivacyState retry", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.resetModules();
  });

  it("recovers from one transient RPC failure instead of locking the page", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: "fetch failed", code: "" } })
      .mockResolvedValueOnce({ data: [okRow], error: null });
    const { getAccountPrivacyState } = await import("@/features/account-privacy/queries");

    const state = await getAccountPrivacyState();

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(state.enabled).toBe(false);
    expect(state.loadFailed).toBeUndefined();
  });

  it("still fails closed when the retry also fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "fetch failed", code: "" } });
    const { getAccountPrivacyState } = await import("@/features/account-privacy/queries");

    const state = await getAccountPrivacyState();

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(state).toMatchObject({ enabled: true, isUnlocked: false, displayStyle: "unavailable", loadFailed: true });
  });
});
