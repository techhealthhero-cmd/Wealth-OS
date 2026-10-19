import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInvoice, getInvoiceFormContext, listInvoices } from "@/features/invoices/queries";
import en from "@/i18n/locales/en.json";
type Row = Record<string, unknown>;
let db: Record<string, Row[]>;
let user: { id: string } | null;
let failures: { table: string; code: string; message: string; after?: number }[];
let calls: { table: string; column: string; value: unknown }[];
const ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
class Query {
  private filters: ((row: Row) => boolean)[] = [];
  private orders: { key: string; ascending: boolean }[] = [];
  private start = 0;
  private end = Infinity;
  constructor(private table: string) {}
  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    calls.push({ table: this.table, column, value });
    this.filters.push((row) => row[column] === value);
    return this;
  }
  order(key: string, options?: { ascending?: boolean }) {
    this.orders.push({ key, ascending: options?.ascending ?? true });
    return this;
  }
  range(from: number, to: number) {
    this.start = from;
    this.end = to;
    return this;
  }
  run() {
    const failure = failures.find((f) => f.table === this.table && this.start >= (f.after ?? 0));
    if (failure) return { data: null, error: failure };
    const rows = [...(db[this.table] ?? [])]
      .filter((row) => this.filters.every((f) => f(row)))
      .sort((a, b) => {
        for (const { key, ascending } of this.orders) {
          const cmp = a[key] === b[key] ? 0 : a[key]! < b[key]! ? -1 : 1;
          if (cmp) return ascending ? cmp : -cmp;
        }
        return 0;
      });
    return { data: rows.slice(this.start, this.end + 1), error: null };
  }
  maybeSingle() {
    const result = this.run();
    return Promise.resolve({ ...result, data: result.data?.[0] ?? null });
  }
  then(resolve: (result: ReturnType<Query["run"]>) => unknown) {
    return Promise.resolve(this.run()).then(resolve);
  }
}
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => new Query(table),
  }),
}));
vi.mock("@/features/profile/queries", () => ({
  getProfile: async () => ({ timezone: "Asia/Bangkok", preferred_language: "en" }),
}));
vi.mock("@/i18n/server", () => ({ getLocale: async () => "en" }));
vi.mock("@/lib/db-error", () => ({ friendlyDbError: (_e: unknown, _c: string, fallback: string) => fallback }));
const today = "2026-10-19";
const row = {
  id: ID,
  user_id: "me",
  invoice_number: "INV-2569-016",
  client_name: "Studio Mango",
  client_is_company: true,
  issue_date: "2026-10-01",
  due_date: "2026-10-05",
  status: "sent",
  withholding_rate_pct: 3,
  subtotal_amount: "20000.00",
  net_amount: "19400.00",
  paid_at: null,
  created_at: "2026-10-02",
  receive_account_id: ACCOUNT,
  notes: "memo",
};
beforeEach(() => {
  user = { id: "me" };
  calls = [];
  failures = [];
  db = {
    invoices: [{ ...row }, { ...row, user_id: "other", id: "other" }],
    invoice_items: [
      {
        user_id: "me",
        invoice_id: ID,
        id: "b",
        description: "Second",
        quantity: "2.50",
        unit_price: "2000.00",
        position: 1,
      },
      { user_id: "me", invoice_id: ID, id: "a", description: "First", quantity: 1, unit_price: 15000, position: 0 },
      { user_id: "other", invoice_id: ID, description: "Private", position: -1 },
    ],
    accounts: [
      {
        id: ACCOUNT,
        user_id: "me",
        name: "SCB",
        account_type: "bank",
        is_archived: false,
        sort_order: 0,
        created_at: "2026-01-01",
      },
      { id: "other", user_id: "other", name: "Private", is_archived: false },
    ],
  };
});
describe("invoice reads", () => {
  it("lists all statuses, scoping by owner, deriving cents/status/overdue", async () => {
    db.invoices.push(...["draft", "paid", "void"].map((status) => ({ ...row, id: status, status })));
    const result = await listInvoices(today);
    expect(result.error).toBeUndefined();
    expect(result.invoices).toHaveLength(4);
    expect(result.invoices?.find((i) => i.id === ID)).toMatchObject({
      netReceivableCents: 1940000,
      displayStatus: "overdue",
      daysOverdue: 14,
    });
    expect(result.invoices?.find((i) => i.id === "draft")).toMatchObject({ displayStatus: "draft", daysOverdue: 0 });
    expect(calls).toContainEqual({ table: "invoices", column: "user_id", value: "me" });
  });
  it("paginates beyond 500 and does not return partial success on later-page failure", async () => {
    db.invoices = Array.from({ length: 501 }, (_, i) => ({
      ...row,
      id: String(i),
      invoice_number: `INV-2569-${String(i + 1).padStart(3, "0")}`,
    }));
    expect((await listInvoices(today)).invoices).toHaveLength(501);
    expect((await getInvoiceFormContext(today)).context?.suggestedNumber).toBe("INV-2569-502");
    failures = [{ table: "invoices", code: "XX000", message: "failure", after: 500 }];
    expect(await listInvoices(today)).toEqual({ error: en.invoices.failed });
    expect(await getInvoiceFormContext(today)).toEqual({ error: en.invoices.failed });
  });
  it("reads owned header/items/account; sorts items by position; parses quantity/cents", async () => {
    const result = await getInvoice(ID, today);
    expect(result.invoice?.receiveAccountName).toBe("SCB");
    expect(result.invoice?.items).toEqual([
      { description: "First", quantity: 1, unitPriceCents: 1500000 },
      { description: "Second", quantity: 2.5, unitPriceCents: 200000 },
    ]);
    for (const table of ["invoices", "invoice_items", "accounts"])
      expect(calls).toContainEqual({ table, column: "user_id", value: "me" });
  });
  it("missing or another user's invoice is null, without reading its items", async () => {
    expect(await getInvoice("33333333-3333-4333-8333-333333333333", today)).toEqual({ success: true, invoice: null });
    expect(calls.some((c) => c.table === "invoice_items")).toBe(false);
  });
  it("validates IDs and dates before reads", async () => {
    expect(await getInvoice("not-uuid", today)).toEqual({ error: en.common.invalidInput });
    expect(await listInvoices("2026-02-30")).toEqual({ error: en.common.invalidInput });
    expect(await getInvoiceFormContext("bad")).toEqual({ error: en.common.invalidInput });
    expect(calls).toEqual([]);
  });
  it("requires authentication for every loader", async () => {
    user = null;
    for (const result of [await listInvoices(today), await getInvoice(ID, today), await getInvoiceFormContext(today)])
      expect(result).toEqual({ error: en.common.pleaseLogin });
    expect(calls).toEqual([]);
  });
  it.each(["invoices", "invoice_items", "accounts"])("detail propagates %s failures", async (table) => {
    failures = [{ table, code: "XX000", message: "failure" }];
    expect(await getInvoice(ID, today)).toEqual({ error: en.invoices.failed });
  });
  it("reports missing migration explicitly, never as empty success", async () => {
    failures = [{ table: "invoices", code: "42P01", message: 'relation "invoices" does not exist' }];
    for (const result of [await listInvoices(today), await getInvoice(ID, today), await getInvoiceFormContext(today)])
      expect(result).toEqual({ error: en.invoices.migrationPending });
  });
  it("form context groups most recent clients, suggests next Buddhist number, scopes active accounts", async () => {
    db.invoices.push({
      ...row,
      id: "new",
      client_name: " studio mango ",
      withholding_rate_pct: 1,
      invoice_number: "INV-2569-017",
      created_at: "2026-10-10",
    });
    const result = await getInvoiceFormContext(today);
    expect(result.context?.clients).toHaveLength(1);
    expect(result.context?.clients[0]).toMatchObject({
      clientName: "studio mango",
      withholdingRatePct: 1,
      subtotalCents: 2000000,
    });
    expect(result.context?.accounts).toHaveLength(1);
    expect(result.context?.defaultReceiveAccountId).toBe(ACCOUNT);
    expect(result.context?.suggestedNumber).toBe("INV-2569-018");
    expect(result.context?.today).toBe(today);
    expect(calls).toContainEqual({ table: "accounts", column: "is_archived", value: false });
  });
  it("falls back from missing/archived recent account to first bank/cash; none stays null", async () => {
    db.invoices[0].receive_account_id = "archived";
    expect((await getInvoiceFormContext(today)).context?.defaultReceiveAccountId).toBe(ACCOUNT);
    db.accounts = [];
    expect((await getInvoiceFormContext(today)).context?.defaultReceiveAccountId).toBeNull();
  });
  it("paginates active receiving accounts without leaking other owners", async () => {
    db.accounts = Array.from({ length: 501 }, (_, i) => ({
      id: `account-${i}`,
      user_id: "me",
      name: `Bank ${i}`,
      account_type: "bank",
      is_archived: false,
      sort_order: i,
      created_at: "2026-01-01",
    }));
    db.accounts.push({ id: "foreign", user_id: "other", is_archived: false });
    expect((await getInvoiceFormContext(today)).context?.accounts).toHaveLength(501);
    failures = [{ table: "accounts", code: "XX000", message: "failure", after: 500 }];
    expect(await getInvoiceFormContext(today)).toEqual({ error: en.invoices.failed });
  });
  it("context propagates account errors instead of empty accounts", async () => {
    failures = [{ table: "accounts", code: "XX000", message: "failure" }];
    expect(await getInvoiceFormContext(today)).toEqual({ error: en.invoices.failed });
  });
});
