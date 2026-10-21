import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  gate: vi.fn(), profile: vi.fn(), categories: vi.fn(), auth: vi.fn(), create: vi.fn(),
  pages: [] as { data: unknown[] | null; error: unknown }[], calls: [] as [string, ...unknown[]][],
}));
vi.mock("@/features/account-privacy/gate", () => ({ getPrivacyGate: state.gate }));
vi.mock("@/features/profile/queries", () => ({ getProfile: state.profile }));
vi.mock("@/features/categories/queries", () => ({ getCategories: state.categories }));
vi.mock("@/lib/supabase/server", () => ({ createClient: state.create }));
import { getMonthlySpendSummary } from "@/features/dashboard/monthly-spend-actions";
import { getSlipCandidates } from "@/features/capture/slip-auto-actions";
beforeEach(() => {
  vi.clearAllMocks(); state.calls = []; state.pages = [];
  state.gate.mockResolvedValue(null); state.profile.mockResolvedValue({ timezone: "Asia/Bangkok" });
  state.categories.mockResolvedValue([]); state.auth.mockResolvedValue({ data: { user: { id: "signed-in-user" } } });
  state.create.mockImplementation(async () => ({ auth: { getUser: state.auth }, from(table: string) {
    state.calls.push(["from", table]);
    const q: Record<string, (...args: unknown[]) => unknown> = Object.fromEntries(["select", "eq", "gte", "lte", "order", "in"].map(method => [method, (...args: unknown[]) => { state.calls.push([method, ...args]); return q; }]));
    q.range = (start: unknown, end: unknown) => { state.calls.push(["range", start, end]); return Promise.resolve(state.pages.shift() ?? { data: [], error: null }); };
    return q;
  } }));
});
afterEach(() => { vi.useRealTimers(); });
describe("monthly summary read action", () => {
  it.each([
    ["2026-10-31T16:59:59Z", "2026-10-01", "2026-10-31"],
    ["2026-10-31T17:00:00Z", "2026-11-01", "2026-11-30"],
    ["2026-12-31T17:00:00Z", "2027-01-01", "2027-01-31"],
  ])("uses Bangkok's current month at %s", async (now, from, to) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(now));
    await getMonthlySpendSummary();
    expect(state.calls).toContainEqual(["gte", "transaction_date", from]);
    expect(state.calls).toContainEqual(["lte", "transaction_date", to]);
  });
  it("checks privacy before reading financial rows", async () => {
    state.gate.mockResolvedValue({ locked: true });
    expect(await getMonthlySpendSummary("2026-10")).toBeNull();
    expect(state.create).not.toHaveBeenCalled();
  });
  it("requires session auth, scopes every page and refetches the selected month", async () => {
    state.pages.push({ data: [{ id: "one", amount: "12.34", type: "expense", transaction_date: "2026-10-20", category_id: null, merchant: "synthetic", description: null }], error: null });
    expect((await getMonthlySpendSummary("2026-10"))?.spentCents).toBe(1234);
    expect(state.calls).toContainEqual(["eq", "user_id", "signed-in-user"]);
    expect(state.calls).toContainEqual(["gte", "transaction_date", "2026-10-01"]);
    expect(state.calls).toContainEqual(["lte", "transaction_date", "2026-10-31"]);
    state.calls = [];
    await getMonthlySpendSummary("2026-09");
    expect(state.calls).toContainEqual(["gte", "transaction_date", "2026-09-01"]);
    expect(state.calls).toContainEqual(["lte", "transaction_date", "2026-09-30"]);
    state.auth.mockResolvedValue({ data: { user: null } }); state.calls = [];
    expect(await getMonthlySpendSummary("2026-10")).toBeNull();
    expect(state.calls).toEqual([]);
  });
  it("reads beyond the database row cap and fails closed on read errors", async () => {
    state.pages.push({ data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i), amount: "1", type: "income", transaction_date: "2026-10-20", category_id: null, merchant: null, description: null })), error: null }, { data: [{ id: "last", amount: "2", type: "income", transaction_date: "2026-10-20", category_id: null, merchant: null, description: null }], error: null });
    expect((await getMonthlySpendSummary("2026-10"))?.incomeCents).toBe(100200);
    expect(state.calls).toContainEqual(["range", 1000, 1999]);
    state.pages.push({ data: null, error: { message: "offline" } });
    await expect(getMonthlySpendSummary("2026-10")).rejects.toThrow("โหลดสรุป");
  });
});
describe("on-device slip candidate read action", () => {
  it("looks up references even outside the OCR dates, dedupes results and scopes all reads", async () => {
    const row = { id: "prior", reference: "ref", transaction_date: "2026-10-20", amount: "12.34", type: "expense" };
    state.pages.push({ data: [row], error: null }, { data: [row], error: null });
    expect(await getSlipCandidates({ dates: ["2026-10-20"], references: ["ref"] })).toEqual([row]);
    expect(state.calls).toContainEqual(["in", "reference", ["ref"]]);
    expect(state.calls.filter(c => c[0] === "eq")).toEqual([["eq", "user_id", "signed-in-user"], ["eq", "user_id", "signed-in-user"]]);
    expect(state.calls.filter(c => c[0] === "select").every(c => !(c[1] as string).includes("image"))).toBe(true);
  });
  it("does not turn privacy/auth/query errors into an empty duplicate set", async () => {
    state.gate.mockResolvedValue({ locked: true });
    await expect(getSlipCandidates({ dates: [], references: [] })).rejects.toThrow("ปลดล็อก");
    expect(state.create).not.toHaveBeenCalled();
    state.gate.mockResolvedValue(null); state.auth.mockResolvedValue({ data: { user: null } });
    await expect(getSlipCandidates({ dates: [], references: [] })).rejects.toThrow("เข้าสู่ระบบ");
    state.auth.mockResolvedValue({ data: { user: { id: "signed-in-user" } } });
    state.pages.push({ data: null, error: { message: "offline" } });
    await expect(getSlipCandidates({ dates: ["2026-10-20"], references: [] })).rejects.toThrow("ตรวจรายการซ้ำ");
  });
});
