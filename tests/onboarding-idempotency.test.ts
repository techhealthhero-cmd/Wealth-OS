import { beforeEach, describe, expect, it, vi } from "vitest";

import { completeOnboarding } from "@/features/profile/actions";

/**
 * Regression test for the onboarding double-submit bug: a rapid double
 * submit (double-click, held Enter, or a network retry) used to invoke
 * `completeOnboarding` twice before the client-side `disabled` state took
 * effect, and — because the profile update + account insert were two
 * unconditional writes with no idempotency guard — both invocations passed
 * every check identically, creating two starting accounts for one user
 * action. Fixed by turning the profile update into an atomic
 * compare-and-swap (`.eq("onboarding_completed", false)`): only the
 * request that actually flips the flag proceeds to create the account.
 *
 * Mocks Supabase and Next's `redirect` — never touches a real database.
 */

type Row = Record<string, unknown>;

let profiles: Row[];
let accounts: Row[];
let currentUser: { id: string } | null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from(table: string) {
      if (table === "profiles") {
        return {
          update: (payload: Row) => {
            const filters: [string, unknown][] = [];
            const builder = {
              eq(col: string, val: unknown) {
                filters.push([col, val]);
                return builder;
              },
              select() {
                return {
                  async maybeSingle() {
                    const row = profiles.find((r) => filters.every(([c, v]) => r[c] === v));
                    if (!row) return { data: null, error: null };
                    Object.assign(row, payload);
                    return { data: { user_id: row.user_id }, error: null };
                  },
                };
              },
            };
            return builder;
          },
        };
      }
      if (table === "accounts") {
        return {
          insert: (payload: Row) => {
            accounts.push({ ...payload });
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      throw new Error(`unexpected table in test: ${table}`);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

async function submitOnboarding() {
  const formData = new FormData();
  formData.set("display_name", "Nan");
  formData.set("starting_balance", "1000");
  formData.set("starting_account_type", "cash");
  try {
    await completeOnboarding(undefined, formData);
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "NEXT_REDIRECT") throw e;
  }
}

describe("completeOnboarding — double-submit idempotency", () => {
  beforeEach(() => {
    profiles = [{ user_id: "user-1", display_name: null, onboarding_completed: false }];
    accounts = [];
    currentUser = { id: "user-1" };
    vi.clearAllMocks();
  });

  it("creates exactly one starting account when submitted once", async () => {
    await submitOnboarding();
    expect(accounts).toHaveLength(1);
    expect(profiles[0].onboarding_completed).toBe(true);
  });

  it("creates exactly one starting account when the same submission races itself (rapid double-submit)", async () => {
    await Promise.all([submitOnboarding(), submitOnboarding()]);
    expect(accounts).toHaveLength(1);
    expect(profiles[0].onboarding_completed).toBe(true);
  });

  it("does not create a second account on a later resubmission after onboarding already completed", async () => {
    await submitOnboarding();
    expect(accounts).toHaveLength(1);

    await submitOnboarding();
    expect(accounts).toHaveLength(1);
  });
});
