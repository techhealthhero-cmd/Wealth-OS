import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), revalidate: vi.fn(), auth: vi.fn(), from: vi.fn(), delete: vi.fn(), in: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.create }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/features/profile/queries", () => ({ getProfile: async () => ({ preferred_language: "en" }) }));
vi.mock("@/i18n/server", () => ({ getLocale: async () => "en" }));
import { deleteTransaction, deleteTransactionsBatch } from "@/features/transactions/actions";
const ids = ["abcdef00-0000-4000-8000-000000000001", "abcdef00-0000-4000-8000-000000000002"];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ data: { user: { id: "owner" } } });
  mocks.eq.mockResolvedValue({ error: null, count: 2 });
  mocks.in.mockReturnValue({ eq: mocks.eq });
  mocks.delete.mockReturnValue({ in: mocks.in });
  mocks.from.mockReturnValue({ delete: mocks.delete });
  mocks.create.mockResolvedValue({ auth: { getUser: mocks.auth }, from: mocks.from });
});
describe("transaction batch delete", () => {
  it.each([null, "bad", [], ["invalid"], [ids[0], 42], Array(501).fill(ids[0])])("rejects invalid input %# before DB access", async input => {
    expect(await deleteTransactionsBatch(input as string[])).toHaveProperty("error");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("deduplicates UUIDs and deletes all IDs in one owner-scoped statement", async () => {
    expect(await deleteTransactionsBatch([...ids, ids[0].toUpperCase()])).toEqual({ success: true, deleted: 2 });
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("transactions");
    expect(mocks.delete).toHaveBeenCalledExactlyOnceWith({ count: "exact" });
    expect(mocks.in).toHaveBeenCalledExactlyOnceWith("id", ids);
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("user_id", "owner");
    expect(mocks.revalidate.mock.calls).toEqual([["/money/transactions"], ["/money/accounts"], ["/dashboard"]]);
  });
  it("supports the full 500-slip picker limit in one call", async () => {
    const many = Array.from({ length: 500 }, (_, i) => `abcdef00-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(await deleteTransactionsBatch(many)).toHaveProperty("success", true);
    expect(mocks.in).toHaveBeenCalledExactlyOnceWith("id", many);
  });
  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null } });
    expect(await deleteTransactionsBatch(ids)).toHaveProperty("error");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("returns failure without revalidation when the atomic statement fails", async () => {
    mocks.eq.mockResolvedValue({ error: { code: "23503", message: "constraint" }, count: null });
    expect(await deleteTransactionsBatch(ids)).toHaveProperty("error");
    expect(mocks.delete).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("allows safe retries after rows have already disappeared", async () => {
    mocks.eq.mockResolvedValue({ error: null, count: 0 });
    expect(await deleteTransactionsBatch(ids)).toEqual({ success: true, deleted: 0 });
  });
  it("shares deletion and invalidation behavior with the single action", async () => {
    expect(await deleteTransaction(ids[0])).toHaveProperty("success", true);
    expect(mocks.in).toHaveBeenCalledExactlyOnceWith("id", [ids[0]]);
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("user_id", "owner");
    expect(mocks.revalidate).toHaveBeenCalledTimes(3);
  });
});
