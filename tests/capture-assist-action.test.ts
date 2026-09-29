import { beforeEach, describe, expect, it, vi } from "vitest";

import { assistCaptureParse } from "@/features/capture/actions";

const generate = vi.fn();

vi.mock("@/features/ai/lib/provider", () => ({
  getAIProvider: () => ({ name: "test", model: "test-model", generate, stream: vi.fn() }),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/billing/ai-usage", () => ({
  getAIUsageStatus: async () => ({ limitReached: false, remaining: 10, used: 0, limit: 10, resetDate: "2026-10-01" }),
}));
vi.mock("@/features/profile/queries", () => ({ getProfile: async () => ({ timezone: "Asia/Bangkok" }) }));
vi.mock("@/i18n/server", () => ({ getLocale: async () => "en" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const categories = [
  { id: "food", name_th: "อาหาร", name_en: "Food & Dining", type: "expense", icon: null, is_system: true },
  { id: "transport", name_th: "เดินทาง", name_en: "Transport", type: "expense", icon: null, is_system: true },
  { id: "utilities", name_th: "ค่าสาธารณูปโภค", name_en: "Utilities", type: "expense", icon: null, is_system: true },
  { id: "other", name_th: "อื่นๆ", name_en: "Other", type: "expense", icon: null, is_system: true },
];
const accounts = [
  { id: "cash", name: "Cash", account_type: "cash", institution: null, is_archived: false },
  { id: "kbank", name: "KBank", account_type: "bank", institution: "Kasikorn", is_archived: false },
];

class Query {
  constructor(private table: string) {}
  select() { return this; }
  eq() { return this; }
  order() { return this; }
  limit() { return this; }
  insert() { return Promise.resolve({ data: null, error: null }); }
  then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
    const rows = this.table === "categories" ? categories : this.table === "accounts" ? accounts : [];
    return Promise.resolve(resolve({ data: rows, error: null }));
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) => new Query(table),
  }),
}));

describe("assistCaptureParse server-side cost gate", () => {
  beforeEach(() => {
    generate.mockReset();
    generate.mockResolvedValue({
      content: '{"type":"expense","amount":1280,"merchant":"Fuji","category":"Food & Dining","payment":"KBank","date":"2026-09-29","description":"กินข้าว","confidence":"high"}',
      model: "test-model",
      usage: { inputTokens: 10, outputTokens: 10 },
    });
  });

  it.each(["ข้าว 80 cash", "Grab 145", "กาแฟ 75 บาท", "ค่าไฟ 1200 จ่าย KBank"])(
    "makes zero AI calls for deterministic input: %s",
    async (text) => {
      expect(await assistCaptureParse(text)).toEqual({ status: "not_needed" });
      expect(generate).not.toHaveBeenCalled();
    }
  );

  it("makes exactly one AI call for a complex input", async () => {
    const result = await assistCaptureParse("เมื่อคืนพาแฟนไปกินข้าวที่ร้าน Fuji จ่ายไป 1280 จาก KBank");
    expect(result.status).toBe("ok");
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
