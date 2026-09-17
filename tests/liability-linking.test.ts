import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLiability, updateLiability } from "@/features/liabilities/actions";

/**
 * Application-layer regression tests for `liabilities.linked_account_id`
 * (migration 0013 — see CLAUDE.md "LIABILITY <-> ACCOUNT LINKING").
 *
 * The actual cross-user ownership guard is a database trigger
 * (`check_liability_linked_account_ownership_trg`) that can only be fully
 * verified against a real Postgres instance — not done in this suite (no
 * live DB access in this environment, see the final report's "Live
 * Verification" section). What IS verified here, with a mocked Supabase
 * client: that `createLiability`/`updateLiability` correctly plumb
 * `linked_account_id` through to the insert/update payload, and that a
 * rejection from the database (simulating the trigger firing) surfaces as
 * a normal friendly error rather than crashing or silently succeeding.
 */

type Row = Record<string, unknown>;

let liabilities: Row[];
let currentUser: { id: string } | null;
let rejectLink: boolean;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from(table: string) {
      if (table !== "liabilities") throw new Error(`unexpected table: ${table}`);
      return {
        insert: (payload: Row) => {
          if (rejectLink && payload.linked_account_id) {
            return Promise.resolve({
              data: null,
              error: { code: "P0001", message: "linked_account_id must reference an account owned by the same user" },
            });
          }
          const row = { id: "liab-1", ...payload };
          liabilities.push(row);
          return Promise.resolve({ data: row, error: null });
        },
        update: (payload: Row) => ({
          eq: () => ({
            eq: () => {
              if (rejectLink && payload.linked_account_id) {
                return Promise.resolve({
                  data: null,
                  error: { code: "P0001", message: "linked_account_id must reference an account owned by the same user" },
                });
              }
              const existing = liabilities[0];
              if (existing) Object.assign(existing, payload);
              return Promise.resolve({ data: null, error: null });
            },
          }),
        }),
      };
    },
  }),
}));

vi.mock("@/features/profile/queries", () => ({
  getProfile: async () => null,
}));
vi.mock("@/i18n/server", () => ({
  getLocale: async () => "en",
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const OWN_ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OTHER_USERS_ACCOUNT = "22222222-2222-4222-8222-222222222222";

function liabilityFormData(opts: { linkedAccountId?: string } = {}) {
  const fd = new FormData();
  fd.set("name", "Krungsri Card");
  fd.set("liability_type", "credit_card");
  fd.set("balance", "20000");
  if (opts.linkedAccountId) fd.set("linked_account_id", opts.linkedAccountId);
  return fd;
}

describe("createLiability/updateLiability — linked_account_id", () => {
  beforeEach(() => {
    liabilities = [];
    currentUser = { id: "user-1" };
    rejectLink = false;
  });

  it("creates a liability with no link (null) exactly as before this feature existed", async () => {
    const result = await createLiability(undefined, liabilityFormData());
    expect(result.success).toBe(true);
    expect(liabilities[0].linked_account_id).toBeFalsy();
  });

  it("creates a liability linked to the user's own credit-card account", async () => {
    const result = await createLiability(undefined, liabilityFormData({ linkedAccountId: OWN_ACCOUNT }));
    expect(result.success).toBe(true);
    expect(liabilities[0].linked_account_id).toBe(OWN_ACCOUNT);
  });

  it("a rejected cross-user link (DB trigger firing) surfaces as a friendly error, not a crash or a silent link", async () => {
    rejectLink = true;
    const result = await createLiability(undefined, liabilityFormData({ linkedAccountId: OTHER_USERS_ACCOUNT }));
    expect(result.success).toBeFalsy();
    expect(result.error).toBeTruthy();
    expect(liabilities).toHaveLength(0);
  });

  it("updateLiability can add a link to an existing unlinked liability", async () => {
    await createLiability(undefined, liabilityFormData());
    const result = await updateLiability("liab-1", undefined, liabilityFormData({ linkedAccountId: OWN_ACCOUNT }));
    expect(result.success).toBe(true);
    expect(liabilities[0].linked_account_id).toBe(OWN_ACCOUNT);
  });

  it("updateLiability rejects a cross-user link attempt without mutating the existing row", async () => {
    await createLiability(undefined, liabilityFormData());
    rejectLink = true;
    const result = await updateLiability("liab-1", undefined, liabilityFormData({ linkedAccountId: OTHER_USERS_ACCOUNT }));
    expect(result.success).toBeFalsy();
    expect(liabilities[0].linked_account_id).toBeFalsy();
  });
});
