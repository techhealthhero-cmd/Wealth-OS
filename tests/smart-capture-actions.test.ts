import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveSmartCapture } from "@/features/capture/smart-capture-actions";
import { parsePurchaseIntent } from "@/lib/capture/purchase-intent";
import type { SmartCaptureSaveInput } from "@/features/capture/smart-capture-actions";
// In-memory Supabase fake in the style of capture-actions.test.ts; never accesses a DB.
type Row = Record<string, unknown>;
let db: Record<string, Row[]>;
let currentUser: { id: string } | null;
let migrated: boolean;
let nextId: number;
let failingRecurring: "select" | "insert" | null = null;
let failingTable: string | null = null;

const NEW_COLUMNS = ["review_status", "ai_confidence", "reference"];

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Row | null = null;
  private limitN = Infinity;
  constructor(private table: string) {}

  select() {
    return this;
  }
  insert(payload: Row) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row) {
    this.op = "upsert";
    this.payload = payload;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  gte(col: string, val: string) {
    this.filters.push((r) => String(r[col]) >= val);
    return this;
  }
  lte(col: string, val: string) {
    this.filters.push((r) => String(r[col]) <= val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  like(col: string, val: string) {
    this.filters.push((r) => String(r[col] ?? "").includes(val.replace(/^%|%$/g, "")));
    return this;
  }
  ilike(col: string, val: string) {
    this.filters.push((r) => String(r[col] ?? "").toLowerCase() === val.toLowerCase());
    return this;
  }
  or() {
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }

  private rows() {
    return (db[this.table] ??= []);
  }

  private run(): { data: Row[] | null; error: { code: string; message: string } | null } {
    if (this.table === failingTable && this.op === "insert") return { data: null, error: { code: "XX000", message: "synthetic failure" } };
    if (this.table === "recurring_transactions" && this.op === failingRecurring) return { data: null, error: { code: "XX000", message: "synthetic failure" } };
    if (!migrated && this.table === "merchant_category_preferences") {
      return { data: null, error: { code: "42P01", message: "relation does not exist" } };
    }
    if (this.op === "insert" || this.op === "update") {
      if (!migrated && this.table === "transactions" && NEW_COLUMNS.some((c) => c in this.payload!)) {
        return { data: null, error: { code: "PGRST204", message: "Could not find the column" } };
      }
    }
    if (this.op === "insert") {
      const p = this.payload!;
      if (p.id && this.rows().some((r) => r.id === p.id)) return { data: null, error: { code: "23505", message: "duplicate primary key" } };
      if (this.table === "transactions" && p.client_request_id) {
        if (this.rows().some((r) => r.user_id === p.user_id && r.client_request_id === p.client_request_id)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
      }
      // Column defaults the real schema applies on insert.
      const defaults: Row =
        this.table === "transactions" && migrated
          ? { review_status: "confirmed" }
          : this.table === "merchant_category_preferences"
            ? { usage_count: 1 }
            : {};
      const row = { id: `row-${nextId++}`, ...defaults, ...p };
      this.rows().push(row);
      return { data: [row], error: null };
    }
    if (this.op === "upsert") {
      const p = this.payload!;
      const existing = this.rows().find((r) => r.user_id === p.user_id && r.merchant === p.merchant);
      if (existing) Object.assign(existing, p);
      else this.rows().push({ id: `row-${nextId++}`, ...p });
      return { data: null, error: null };
    }
    const matched = this.rows().filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") matched.forEach((r) => Object.assign(r, this.payload));
    return { data: matched.slice(0, this.limitN), error: null };
  }

  single() {
    const { data, error } = this.run();
    return Promise.resolve({ data: data?.[0] ?? null, error: error ?? (data?.[0] ? null : { code: "PGRST116", message: "no rows" }) });
  }
  maybeSingle() {
    const { data, error } = this.run();
    return Promise.resolve({ data: data?.[0] ?? null, error });
  }
  then(onfulfilled: (r: { data: Row[] | null; error: unknown }) => unknown) {
    return Promise.resolve(onfulfilled(this.run()));
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from: (table: string) => new Query(table),
  }),
}));
vi.mock("@/features/profile/queries", () => ({ getProfile: async () => null }));
vi.mock("@/i18n/server", () => ({ getLocale: async () => "en" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const FOOD = "22222222-2222-4222-8222-222222222222";
const date = "2026-10-19";
function input(text = "ซื้อคอมใหม่ 20,000 เงินสด", more: Partial<SmartCaptureSaveInput> = {}): SmartCaptureSaveInput {
  const smart = parsePurchaseIntent(text, date)!;
  return { capture: {
    clientRequestId: crypto.randomUUID(), type: smart.kind === "loan" ? "income" : "expense", amountCents: smart.amountCents,
    accountId: ACCOUNT, categoryId: FOOD, merchant: smart.assetName, description: null, date,
    source: "quick_text", confidence: "high", categoryConfirmedByUser: false,
  }, smart, ...more };
}
beforeEach(() => {
  db = { accounts: [{ id: ACCOUNT, user_id: "user-1", is_archived: false }] };
  currentUser = { id: "user-1" }; migrated = true; nextId = 1; failingRecurring = null; failingTable = null;
});
describe("smart capture saves", () => {
  it("rejects unauthenticated and invalid calls without writes", async () => {
    currentUser = null;
    expect((await saveSmartCapture(input())).error).toBeTruthy();
    currentUser = { id: "user-1" };
    const d = input(); d.smart.priceCents = -1;
    expect((await saveSmartCapture(d)).error).toBeTruthy();
    expect((await saveSmartCapture({ ...input(), capture: { ...input().capture, accountId: "invalid" } })).error).toBeTruthy();
    expect(db.transactions ?? []).toHaveLength(0);
  });
  it("posts the expense and asset at full cost, with session ownership", async () => {
    const d = input();
    const result = await saveSmartCapture({ ...d, ...({ user_id: "attacker" } as object) });
    expect(result).toMatchObject({ success: true, assetCreated: true });
    expect(db.transactions).toEqual([expect.objectContaining({ amount: "20000.00", type: "expense", account_id: ACCOUNT, user_id: "user-1" })]);
    expect(db.assets).toEqual([expect.objectContaining({ value: 20000, include_in_net_worth: true, asset_type: "other", user_id: "user-1" })]);
    expect(db.assets[0].notes).toContain(`[capture:${d.capture.clientRequestId}]`);
    expect(db.liabilities ?? []).toHaveLength(0);
  });
  it("ask requires an answer; yes creates asset, no posts only expense", async () => {
    const d = input("ซื้อหูฟัง 3,500");
    expect((await saveSmartCapture(d)).error).toBeTruthy();
    expect(await saveSmartCapture({ ...d, assetAccepted: false })).toMatchObject({ success: true });
    expect(db.assets ?? []).toHaveLength(0);
    expect(db.transactions).toHaveLength(1);
    expect(await saveSmartCapture(input("ซื้อหูฟัง 3,500", { assetAccepted: true }))).toMatchObject({ success: true, assetCreated: true });
    expect(db.assets).toHaveLength(1);
  });
  it("saves house down payment, full asset, annual-rate debt and monthly schedule", async () => {
    const d = input("ซื้อบ้าน 2,000,000 ดาวน์ 200,000 ผ่อน 30 ปี ดอก 6%");
    // Do not trust supplied totals or the captured transaction's client amount.
    d.capture.amountCents = 1;
    d.smart.plan!.monthlyPaymentCents = 1;
    expect(await saveSmartCapture(d)).toMatchObject({ success: true, assetCreated: true, liabilityCreated: true, recurringCreated: true });
    expect(db.transactions[0].amount).toBe("200000.00");
    expect(db.assets[0].value).toBe(2000000);
    expect(db.liabilities[0]).toMatchObject({ balance: 1800000, interest_rate: 6, minimum_payment: 10791.91, liability_type: "mortgage", due_date: null });
    expect(db.recurring_transactions[0]).toMatchObject({ type: "expense", amount: 10791.91, account_id: ACCOUNT, start_date: "2026-11-19", next_due_date: "2026-11-19", end_date: "2056-10-19", frequency: "monthly", merchant: "ผ่อนบ้าน" });
  });
  it("zero-down installment creates no transaction, and checks paying-account ownership", async () => {
    const d = input("ซื้อไอโฟน 40,000 ผ่อน 0% 10 เดือน");
    expect(await saveSmartCapture(d)).toMatchObject({ success: true, assetCreated: true, liabilityCreated: true, recurringCreated: true });
    expect(db.transactions ?? []).toHaveLength(0);
    expect(db.liabilities[0]).toMatchObject({ balance: 40000, interest_rate: 0, minimum_payment: 4000 });
    db.accounts[0].user_id = "user-2";
    expect((await saveSmartCapture(input("ซื้อไอโฟน 40,000 ผ่อน 0% 10 เดือน"))).error).toBeTruthy();
  });
  it("loan requires period confirmation and chooses loan income category", async () => {
    const d = input("กู้นอกระบบ 20,000 ดอก 20%");
    expect((await saveSmartCapture(d)).error).toBeTruthy();
    const LOAN = "44444444-4444-4444-8444-444444444444";
    db.categories = [{ id: LOAN, name_th: "เงินกู้", name_en: "Loan", type: "income" }];
    expect(await saveSmartCapture({ ...d, ratePeriod: "month" })).toMatchObject({ success: true, liabilityCreated: true, recurringCreated: true });
    expect(db.transactions[0]).toMatchObject({ type: "income", amount: "20000.00", category_id: LOAN });
    expect(db.liabilities[0]).toMatchObject({ balance: 20000, interest_rate: 240, minimum_payment: 6014.11, liability_type: "informal_debt" });
    expect(db.assets ?? []).toHaveLength(0);
    expect(db.recurring_transactions[0]).toMatchObject({ type: "expense", amount: 6014.11, category_id: null, end_date: "2027-04-19" });
  });
  it("interest-free family loan with no term records the debt without a schedule", async () => {
    expect(await saveSmartCapture(input("ยืมเงินแม่ 5,000"))).toMatchObject({ success: true, liabilityCreated: true });
    expect(db.transactions[0]).toMatchObject({ type: "income", amount: "5000.00" });
    expect(db.liabilities[0]).toMatchObject({ balance: 5000, interest_rate: 0, minimum_payment: null, liability_type: "informal_debt" });
    expect(db.recurring_transactions ?? []).toHaveLength(0);
  });
  it("stated hire-purchase payment keeps all stated installments", async () => {
    expect(await saveSmartCapture(input("ซื้อมอไซค์ 60,000 ดาวน์ 5,000 ผ่อนเดือนละ 2,500 24 งวด"))).toMatchObject({ success: true, recurringCreated: true });
    expect(db.liabilities[0]).toMatchObject({ balance: 55000, minimum_payment: 2500 });
    expect(db.recurring_transactions[0]).toMatchObject({ amount: 2500, end_date: "2028-10-19" });
  });
  it("a balloon final installment gets its own one-off schedule with the exact amount", async () => {
    const d = input("กู้เงิน 20000 ดอก 0% ผ่อนเดือนละ 1000 12 เดือน");
    expect(await saveSmartCapture({ ...d, ratePeriod: "year" })).toMatchObject({ success: true, recurringCreated: true, incomplete: false });
    const rows = db.recurring_transactions;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ amount: 1000, start_date: "2026-11-19", end_date: "2027-09-19" });
    expect(rows[1]).toMatchObject({ amount: 9000, start_date: "2027-10-19", end_date: "2027-10-19" });
  });
  it("separate purchases with identical content remain separate", async () => {
    await saveSmartCapture(input()); await saveSmartCapture(input());
    expect(db.assets).toHaveLength(2); expect(db.transactions).toHaveLength(2);
  });
  it.each(["cash", "installment", "zero-down", "loan"])("sequential and concurrent retries do not duplicate %s", async (kind) => {
    const d = kind === "cash" ? input() : kind === "installment" ? input("ซื้อบ้าน 2000000 ดาวน์ 200000 ผ่อน 30 ปี ดอก 6%") : kind === "zero-down" ? input("ซื้อไอโฟน 40000 ผ่อน 0% 10 เดือน") : input("กู้เงินธนาคาร 100000 ดอก 8% ต่อปี 24 เดือน");
    expect((await saveSmartCapture(d)).success).toBe(true);
    const counts = Object.fromEntries(Object.entries(db).map(([k, v]) => [k, v.length]));
    expect((await saveSmartCapture(d)).success).toBe(true);
    await Promise.all([saveSmartCapture(d), saveSmartCapture(d)]);
    for (const table of ["transactions", "assets", "liabilities", "recurring_transactions"]) expect(db[table]?.length).toBe(counts[table]);
  });
  it("guards simultaneous initial submissions with deterministic PKs", async () => {
    const d = input("ซื้อบ้าน 2000000 ดาวน์ 200000 ผ่อน 30 ปี ดอก 6%");
    const results = await Promise.all([saveSmartCapture(d), saveSmartCapture(d)]);
    expect(results.every((r) => r.success)).toBe(true);
    for (const table of ["transactions", "assets", "liabilities", "recurring_transactions"]) expect(db[table]).toHaveLength(1);
  });
  it.each(["assets", "liabilities", "recurring_transactions"])("preserves durable payment on %s failure and recovers on retry", async (table) => {
    const d = input("ซื้อบ้าน 2000000 ดาวน์ 200000 ผ่อน 30 ปี ดอก 6%");
    failingTable = table;
    const result = await saveSmartCapture(d);
    expect(result.success).toBe(true);
    expect(result[table === "assets" ? "assetError" : table === "liabilities" ? "liabilityError" : "recurringError"]).toBeTruthy();
    expect(db.transactions).toHaveLength(1);
    failingTable = null;
    expect((await saveSmartCapture(d)).success).toBe(true);
    for (const t of ["transactions", "assets", "liabilities", "recurring_transactions"]) expect(db[t]).toHaveLength(1);
  });
});

describe("retry recovery preserves the original intent", () => {
  it("uses the saved transaction amount after an asset-only failure", async () => {
    const d = input();
    failingTable = "assets";
    expect((await saveSmartCapture(d)).success).toBe(true);
    failingTable = null;
    d.smart.priceCents = 100; d.capture.amountCents = 100;
    expect((await saveSmartCapture(d)).success).toBe(true);
    expect(db.assets[0].value).toBe(20000);
    expect(db.transactions).toHaveLength(1);
  });
  it("uses the original terms/date/account to recover a missing recurring plan", async () => {
    const d = input("ซื้อบ้าน 2000000 ดาวน์ 200000 ผ่อน 30 ปี ดอก 6%");
    failingTable = "recurring_transactions";
    await saveSmartCapture(d);
    failingTable = null;
    d.smart.ratePct = 100; d.smart.priceCents = 50; d.smart.downPaymentCents = 0; d.smart.termMonths = 1;
    d.capture.date = "2099-01-01";
    expect((await saveSmartCapture(d)).success).toBe(true);
    expect(db.recurring_transactions[0]).toMatchObject({ amount: 10791.91, start_date: "2026-11-19", end_date: "2056-10-19" });
    expect(db.transactions).toHaveLength(1);
  });
  it("recovers zero-down terms from the asset notes", async () => {
    const d = input("ซื้อไอโฟน 40000 ผ่อน 0% 10 เดือน");
    failingTable = "liabilities";
    await saveSmartCapture(d);
    failingTable = null;
    d.smart.priceCents = 1000; d.capture.date = "2099-01-01";
    expect((await saveSmartCapture(d)).success).toBe(true);
    expect(db.liabilities[0]).toMatchObject({ balance: 40000, minimum_payment: 4000 });
    expect(db.transactions ?? []).toHaveLength(0);
  });
  it("rejects impossible dates without throwing", async () => {
    const d = input(); d.capture.date = "2026-99-99";
    expect((await saveSmartCapture(d)).error).toBeTruthy();
    expect(db.transactions ?? []).toHaveLength(0);
  });
});
