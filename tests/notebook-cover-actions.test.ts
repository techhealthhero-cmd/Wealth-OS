import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";
let currentUser: { id: string } | null;
let updatePayload: Record<string, unknown> | null;
let ownerFilter: unknown;
const setCookie = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: async () => currentUser,
  createClient: async () => ({
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`unexpected table: ${table}`);
      return {
        update: (payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: async (column: string, value: unknown) => {
              expect(column).toBe("user_id");
              ownerFilter = value;
              return { error: null };
            },
          };
        },
      };
    },
  }),
}));
vi.mock("@/features/profile/queries", () => ({
  getProfile: async () => ({ preferred_language: "th", opening_first_played_at: null }),
}));
vi.mock("@/i18n/server", () => ({ getLocale: async () => "th" }));
vi.mock("@/i18n/dictionaries", () => ({
  getDictionary: () => ({ notebookCover: { errors: { signedOut: "signed out", invalid: "invalid", notReady: "not ready", saveFailed: "failed" } } }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: setCookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveCoverPreferences } from "@/features/notebook-cover/actions";

describe("saveCoverPreferences", () => {
  beforeEach(() => {
    currentUser = { id: USER_ID };
    updatePayload = null;
    ownerFilter = null;
    setCookie.mockClear();
  });

  it("validates and saves only against the signed-in user's profile", async () => {
    const result = await saveCoverPreferences({ theme: "midnight", decorations: ["cat"], name: "  My Book  ", openingMode: "quick" });

    expect(result).toEqual({ success: true });
    expect(ownerFilter).toBe(USER_ID);
    expect(updatePayload).toEqual({
      cover_theme: "midnight",
      cover_decorations: ["cat"],
      cover_name: "My Book",
      notebook_opening_mode: "quick",
    });
    expect(setCookie).toHaveBeenCalledOnce();
  });

  it("does not write when the payload is invalid or the user is signed out", async () => {
    expect(await saveCoverPreferences({ theme: "unknown", decorations: [], name: null, openingMode: "quick" } as never)).toMatchObject({
      success: false,
      code: "invalid",
    });
    expect(updatePayload).toBeNull();

    currentUser = null;
    expect(await saveCoverPreferences({ theme: "forest", decorations: [], name: null, openingMode: "quick" })).toMatchObject({ success: false, code: "signed_out" });
    expect(updatePayload).toBeNull();
  });
});
