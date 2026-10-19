import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInvoice, updateInvoice, markInvoicePaid, markInvoiceSent, voidInvoice } from "@/features/invoices/actions";
import { getReceivablesSummary } from "@/features/invoices/queries";
import { addTaxJarEntry, deleteTaxJarEntry, upsertTaxJarSettings } from "@/features/tax-jar/actions";
import { getTaxJarSettings, getTaxJarSummary } from "@/features/tax-jar/queries";
import { suggestNextInvoiceNumber } from "@/features/invoices/number";
import { invoiceSchema, taxJarEntrySchema, taxJarSettingsSchema } from "@/lib/validation/invoices-tax-jar";
import { getDictionary } from "@/i18n/dictionaries";
import { revalidatePath } from "next/cache";

type Row = Record<string, unknown>;
type DbError = { code?: string; message: string };
let db: Record<string, Row[]>;
let user: { id: string } | null;
let timezone: string;
let failures: { table: string; op: string; error: DbError }[];
let rpcError: DbError | null;
let rpcCalls: Row[];
let queryCalls: { table: string; column: string; value: unknown }[];
let beforeUpdate: (() => void) | undefined;
let writes: { table: string; op: string; payload: unknown }[];
const ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const SOURCE = "33333333-3333-4333-8333-333333333333";
const dict = getDictionary("en");
class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op = "select";
  private payload: Row[] = [];
  private orders: { key: string; ascending: boolean }[] = [];
  private start = 0;
  private end = Infinity;
  constructor(private table: string) {}
  select() { return this; }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = Array.isArray(p) ? p : [p]; return this; }
  update(p: Row) { this.op = "update"; this.payload = [p]; return this; }
  upsert(p: Row) { this.op = "upsert"; this.payload = [p]; return this; }
  delete() { this.op = "delete"; return this; }
  eq(column: string, value: unknown) { queryCalls.push({ table: this.table, column, value }); this.filters.push(r => r[column] === value); return this; }
  in(column: string, values: unknown[]) { this.filters.push(r => values.includes(r[column])); return this; }
  order(key: string, options?: { ascending?: boolean }) { this.orders.push({ key, ascending: options?.ascending ?? true }); return this; }
  range(start: number, end: number) { this.start = start; this.end = end; return this; }
  run(): { data: Row[] | null; error: DbError | null } {
    if (this.op !== "select") writes.push({ table: this.table, op: this.op, payload: this.payload });
    const fail = failures.findIndex(f => f.table === this.table && f.op === this.op);
    if (fail !== -1) return { data: null, error: failures.splice(fail, 1)[0].error };
    if (this.op === "update" && beforeUpdate) { const hook = beforeUpdate; beforeUpdate = undefined; hook(); }
    const rows = db[this.table] ??= [];
    if (this.op === "insert") {
      const data = this.payload.map(p => ({ id: crypto.randomUUID(), updated_at: "v1", ...p }));
      rows.push(...data); return { data, error: null };
    }
    if (this.op === "upsert") {
      const old = rows.find(r => r.user_id === this.payload[0].user_id);
      if (old) Object.assign(old, this.payload[0]); else rows.push(this.payload[0]);
      return { data: null, error: null };
    }
    const matched = rows.filter(r => this.filters.every(f => f(r)));
    if (this.op === "delete") db[this.table] = rows.filter(r => !matched.includes(r));
    if (this.op === "update") matched.forEach(r => Object.assign(r, this.payload[0], { updated_at: "v2" }));
    matched.sort((a,b) => {
      for (const { key, ascending } of this.orders) {
        const cmp = String(a[key]).localeCompare(String(b[key]));
        if (cmp) return ascending ? cmp : -cmp;
      }
      return 0;
    });
    return { data: matched.slice(this.start, this.end + 1).map(r => ({ ...r })), error: null };
  }
  maybeSingle() { const r = this.run(); return Promise.resolve({ ...r, data: r.data?.[0] ?? null }); }
  single() { return this.maybeSingle(); }
  then(resolve: (r: ReturnType<Query["run"]>) => unknown) { return Promise.resolve(this.run()).then(resolve); }
}
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getAuthUser: async () => user, createClient: async () => ({
  auth: { getUser: async () => ({ data: { user } }) },
  from: (table: string) => new Query(table),
  rpc: async (name: string, args: Row) => { rpcCalls.push({ name, ...args }); return { data: rpcError ? null : SOURCE, error: rpcError }; },
}) }));
vi.mock("@/features/profile/queries", () => ({ getProfile: async () => ({ timezone, preferred_language: "en" }) }));
vi.mock("@/i18n/server", () => ({ getLocale: async () => "en" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db-error", () => ({ friendlyDbError: (_e: unknown, _c: string, fallback: string) => fallback }));
const input = {
  invoiceNumber: "INV-2569-001", clientName: "Customer", issueDate: "2026-01-01", dueDate: "2026-02-01",
  withholdingRatePct: 3 as const, items: [{ description: "Work", quantity: 1, unitPriceCents: 1_100_000 }],
};
const paid = { invoiceId: ID, paidDate: "2026-01-01" };
const entry = { kind: "set_aside" as const, amountCents: 74_690, taxYear: 2026, sourceTransactionId: SOURCE, entryDate: "2026-01-01" };
function seed(status = "sent") {
  db.invoices = [{ id: ID, user_id: "me", status, updated_at: "v0", invoice_number: "Original", client_name: "Original", net_amount: 10670, subtotal_amount: 11000, withholding_amount: 330, due_date: "2026-01-05" }];
  db.invoice_items = [{ id: ACCOUNT, user_id: "me", invoice_id: ID, description: "Original", line_total: 11000 }];
}
beforeEach(() => {
  beforeUpdate = undefined;
  vi.clearAllMocks(); db = {}; user = { id: "me" }; timezone = "Asia/Bangkok";
  failures = []; rpcError = null; rpcCalls = []; queryCalls = []; writes = [];
});

describe("invoice validation and writes", () => {
  it.each([
    { invoiceNumber: " " }, { invoiceNumber: "a".repeat(41) }, { clientName: "" }, { clientName: "a".repeat(121) },
    { dueDate: "2025-12-31" }, { issueDate: "2026-02-30" }, { withholdingRatePct: 4 }, { items: [] },
    { items: Array.from({ length: 51 }, () => input.items[0]) },
    ...[{ quantity: 0 }, { quantity: -1 }, { quantity: 1.001 }, { unitPriceCents: -1 }, { unitPriceCents: 0.1 }, { unitPriceCents: Infinity }, { description: " " }, { description: "a".repeat(201) }].map(v => ({ items: [{ ...input.items[0], ...v }] })),
  ])("rejects invalid invoice %j", async override => {
    expect(await createInvoice({ ...input, ...override } as typeof input)).toEqual({ error: dict.common.invalidInput });
    expect(writes).toEqual([]);
  });
  it("ignores client totals and ownership/status fields; recomputes rounded lines and withholding", async () => {
    const result = await createInvoice({ ...input, user_id: "theirs", status: "paid", net_amount: 1, subtotalCents: 1,
      items: [{ ...input.items[0], quantity: 1.25, line_total: 1 }, { description: "Extra", quantity: 0.5, unitPriceCents: 101 }],
    } as typeof input);
    expect(result.success).toBe(true);
    expect(db.invoices[0]).toMatchObject({ user_id: "me", status: "draft", subtotal_amount: "13750.51", withholding_amount: "412.52", net_amount: "13337.99" });
    expect(db.invoice_items.map(r => r.line_total)).toEqual(["13750.00", "0.51"]);
  });
  it.each(["paid", "void"])("rejects editing %s invoices without writes", async status => {
    seed(status); expect((await updateInvoice(ID, input)).error).toBe(dict.invoices.notEditable); expect(writes).toEqual([]);
  });
  it("replaces items on editable invoices", async () => {
    seed(); expect((await updateInvoice(ID, input)).success).toBe(true);
    expect(db.invoice_items).toHaveLength(1); expect(db.invoice_items[0].id).not.toBe(ACCOUNT);
    expect(db.invoices[0].net_amount).toBe("10670.00");
  });
  it("cleans up a newly created header when item insertion fails", async () => {
    failures.push({ table: "invoice_items", op: "insert", error: { message: "failed" } });
    expect((await createInvoice(input)).error).toBeTruthy(); expect(db.invoices).toEqual([]);
  });
  it("retains original invoice and items when replacement insert fails", async () => {
    seed(); failures.push({ table: "invoice_items", op: "insert", error: { message: "failed" } });
    expect((await updateInvoice(ID, input)).error).toBeTruthy();
    expect(db.invoice_items[0].description).toBe("Original"); expect(db.invoices[0].invoice_number).toBe("Original");
  });
  it("restores old header and cleans new items when old-item deletion fails", async () => {
    seed(); failures.push({ table: "invoice_items", op: "delete", error: { message: "failed" } });
    expect((await updateInvoice(ID, input)).error).toBeTruthy();
    expect(db.invoice_items).toHaveLength(1); expect(db.invoices[0].invoice_number).toBe("Original");
  });
  it.each(["paid", "void"])("cleans staged items if status becomes %s during an edit", async status => {
    seed(); beforeUpdate = () => { db.invoices[0].status = status; db.invoices[0].updated_at = "concurrent"; };
    expect((await updateInvoice(ID, input)).error).toBe(dict.invoices.notEditable);
    expect(db.invoices[0].status).toBe(status);
    expect(db.invoices[0].invoice_number).toBe("Original");
    expect(db.invoice_items).toHaveLength(1); expect(db.invoice_items[0].id).toBe(ACCOUNT);
  });
  it("rejects concurrent header edits by version and cleans staged items", async () => {
    seed(); beforeUpdate = () => { db.invoices[0].invoice_number = "Newer edit"; db.invoices[0].updated_at = "concurrent"; };
    expect((await updateInvoice(ID, input)).error).toBeTruthy();
    expect(db.invoices[0].invoice_number).toBe("Newer edit"); expect(db.invoice_items).toHaveLength(1);
  });
  it("cleans replacement items after a duplicate-number update fails", async () => {
    seed(); failures.push({ table: "invoices", op: "update", error: { code: "23505", message: "duplicate" } });
    expect((await updateInvoice(ID, input)).error).toBe(dict.invoices.duplicateNumber);
    expect(db.invoice_items).toHaveLength(1); expect(db.invoices[0].invoice_number).toBe("Original");
  });
  it("maps duplicate numbers and missing migration", async () => {
    failures.push({ table: "invoices", op: "insert", error: { code: "23505", message: "unique" } });
    expect((await createInvoice(input)).error).toBe(dict.invoices.duplicateNumber);
    failures.push({ table: "invoices", op: "insert", error: { code: "42P01", message: "missing" } });
    expect((await createInvoice(input)).error).toMatch(/0047/);
  });
  it("requires an income/both category", async () => {
    db.categories = [{ id: ACCOUNT, type: "expense" }];
    expect((await createInvoice({ ...input, categoryId: ACCOUNT })).error).toBe(dict.common.invalidInput);
    db.categories[0].type = "both";
    expect((await createInvoice({ ...input, categoryId: ACCOUNT })).success).toBe(true);
  });
  it("cannot edit someone else's invoice", async () => {
    seed(); db.invoices[0].user_id = "theirs";
    expect((await updateInvoice(ID, input)).error).toBe(dict.invoices.notFound); expect(writes).toEqual([]);
  });
  it("sends drafts once and rejects sending/voiding paid invoices", async () => {
    seed("draft"); expect((await markInvoiceSent(ID)).success).toBe(true);
    const sentAt = db.invoices[0].sent_at; expect(sentAt).toBeTruthy();
    expect((await markInvoiceSent(ID)).error).toBeTruthy(); expect(db.invoices[0].sent_at).toBe(sentAt);
    expect((await voidInvoice(ID)).success).toBe(true);
    seed("paid"); expect((await voidInvoice(ID)).error).toBeTruthy(); expect((await markInvoiceSent(ID)).error).toBeTruthy();
  });
});

describe("mark paid RPC", () => {
  it("passes through idempotent transaction ids and calculates set-aside on cash", async () => {
    seed(); const first = await markInvoicePaid(paid); const second = await markInvoicePaid(paid);
    expect(first).toEqual({ success: true, transactionId: SOURCE, setAsideSuggestion: { amountCents: 74_690, ratePct: 7, mode: "ask" } });
    expect(second).toEqual(first);
    expect(rpcCalls).toEqual(Array(2).fill({ name: "mark_invoice_paid", p_invoice_id: ID, p_paid_date: paid.paidDate, p_account_id: null, p_allow_draft: false }));
    expect(writes).toEqual([]); expect(revalidatePath).toHaveBeenCalledWith("/dashboard"); expect(revalidatePath).toHaveBeenCalledWith("/money/transactions");
  });
  it("passes explicit account/draft confirmation and respects custom rate/mode", async () => {
    seed(); db.tax_jar_settings = [{ user_id: "me", rate_pct: 10, mode: "auto", expense_408_rate_pct: 60, extra_deductions_amount: 0 }];
    expect((await markInvoicePaid({ ...paid, accountId: ACCOUNT, allowDraft: true })).setAsideSuggestion).toEqual({ amountCents: 106700, ratePct: 10, mode: "auto" });
    expect(rpcCalls[0]).toMatchObject({ p_account_id: ACCOUNT, p_allow_draft: true });
  });
  it.each([
    ["invoice_void", dict.invoices.void], ["invoice_not_sent", dict.invoices.notSent], ["invoice_not_found", dict.invoices.notFound],
    ["account_not_found", dict.invoices.accountNotFound], ["not_authenticated", dict.common.pleaseLogin], ["invalid_amount", dict.common.invalidInput],
  ])("maps %s", async (message, expected) => { rpcError = { message }; expect((await markInvoicePaid(paid)).error).toBe(expected); });
  it("maps missing RPC migration", async () => { rpcError = { code: "PGRST202", message: "missing" }; expect((await markInvoicePaid(paid)).error).toMatch(/0047/); });
  it.each(["2999-01-01", "2026-02-30", "2026-1-1", "invalid"])("rejects bad/future paid date %s", async paidDate => {
    expect((await markInvoicePaid({ ...paid, paidDate })).error).toBe(dict.common.invalidInput); expect(rpcCalls).toEqual([]);
  });
  it("validates future dates in the profile timezone", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T18:00:00Z"));
    try {
      seed(); expect((await markInvoicePaid({ ...paid, paidDate: "2026-01-02" })).success).toBe(true);
      timezone = "America/Los_Angeles";
      expect((await markInvoicePaid({ ...paid, paidDate: "2026-01-02" })).error).toBe(dict.common.invalidInput);
    } finally { vi.useRealTimers(); }
  });
  it("preserves payment success if the post-commit suggestion read fails", async () => {
    failures.push({ table: "invoices", op: "select", error: { message: "offline" } });
    expect(await markInvoicePaid(paid)).toMatchObject({ success: true, transactionId: SOURCE, setAsideSuggestion: null });
  });
});

describe("tax jar", () => {
  it("returns defaults only for an absent settings row", async () => {
    expect(await getTaxJarSettings()).toMatchObject({ configured: false, settings: { ratePct: 7, mode: "ask", expense408RatePct: 60, extraDeductionsCents: 0, accountId: null } });
    failures.push({ table: "tax_jar_settings", op: "select", error: { message: "offline" } });
    expect((await getTaxJarSettings()).error).toBeTruthy();
  });
  it.each([{ ratePct: -1 }, { ratePct: 51 }, { mode: "bad" }, { expense408RatePct: 101 }, { expense408RatePct: -1 }, { extraDeductionsCents: -1 }])("rejects invalid settings %j", async value => {
    expect((await upsertTaxJarSettings(value as never)).error).toBe(dict.common.invalidInput); expect(writes).toEqual([]);
  });
  it("upserts decimal baht and reads integer satang back", async () => {
    expect((await upsertTaxJarSettings({ ratePct: 7.5, mode: "auto", expense408RatePct: 40, extraDeductionsCents: 12345, accountId: ACCOUNT })).success).toBe(true);
    expect(db.tax_jar_settings[0]).toMatchObject({ user_id: "me", extra_deductions_amount: "123.45", account_id: ACCOUNT });
    expect(await getTaxJarSettings()).toMatchObject({ configured: true, settings: { ratePct: 7.5, extraDeductionsCents: 12345 } });
  });
  it("delegates account ownership to the DB trigger and reports its failure", async () => {
    failures.push({ table: "tax_jar_settings", op: "upsert", error: { message: "account_id must reference an account owned by the same user" } });
    expect((await upsertTaxJarSettings({ accountId: ACCOUNT })).error).toBeTruthy();
  });
  it.each([{ amountCents: 0 }, { amountCents: -1 }, { amountCents: 1.5 }, { taxYear: 2019 }, { taxYear: 2101 }, { rate: 51 }, { entryDate: "2026-02-30" }, { note: "a".repeat(201) }])("rejects invalid entries %j", async value => {
    expect((await addTaxJarEntry({ ...entry, ...value })).error).toBe(dict.common.invalidInput); expect(writes).toEqual([]);
  });
  it("treats duplicate source set-aside as success with the existing id", async () => {
    db.tax_jar_entries = [{ id: ID, user_id: "me", source_transaction_id: SOURCE, kind: "set_aside" }];
    failures.push({ table: "tax_jar_entries", op: "insert", error: { code: "23505", message: "duplicate" } });
    expect(await addTaxJarEntry(entry)).toEqual({ success: true, id: ID, alreadySetAside: true });
    expect(db.tax_jar_entries).toHaveLength(1);
  });
  it("does not hide unrelated unique violations", async () => {
    failures.push({ table: "tax_jar_entries", op: "insert", error: { code: "23505", message: "duplicate" } });
    expect((await addTaxJarEntry({ ...entry, kind: "withdraw" })).error).toBeTruthy();
  });
  it("sums set-aside + adjust - withdraw; filters owner and year; deletes without updates", async () => {
    await addTaxJarEntry(entry); await addTaxJarEntry({ ...entry, kind: "adjust", amountCents: 1000, sourceTransactionId: null });
    const withdrawal = await addTaxJarEntry({ ...entry, kind: "withdraw", amountCents: 2000, sourceTransactionId: null });
    db.tax_jar_entries.push({ ...db.tax_jar_entries[0], id: "other", user_id: "other" }, { ...db.tax_jar_entries[0], id: "last-year", tax_year: 2025 });
    expect(await getTaxJarSummary(2026)).toMatchObject({ balanceCents: 73690, entries: expect.any(Array) });
    expect((await getTaxJarSummary(2026)).entries).toHaveLength(3);
    await deleteTaxJarEntry(withdrawal.id!);
    expect((await getTaxJarSummary(2026)).balanceCents).toBe(75690);
    expect(writes.some(w => w.op === "update")).toBe(false);
  });
  it("paginates more than 1000 entries without truncating balance", async () => {
    db.tax_jar_entries = Array.from({ length: 1001 }, (_, i) => ({ id: String(i), user_id: "me", kind: "adjust", amount: "0.01", tax_year: 2026, entry_date: "2026-01-01" }));
    const result = await getTaxJarSummary(2026); expect(result.balanceCents).toBe(1001); expect(result.entries).toHaveLength(1001);
  });
});

describe("receivables and numbering", () => {
  it("queries sent invoices for the user, sorted by due date, with overdue cash totals", async () => {
    seed(); db.invoices.push({ ...db.invoices[0], id: ACCOUNT, due_date: "2026-01-10", net_amount: "100.01" },
      { ...db.invoices[0], id: SOURCE, status: "draft" }, { ...db.invoices[0], id: "other", user_id: "other" });
    const result = await getReceivablesSummary("2026-01-10");
    expect(result).toMatchObject({ outstandingCents: 1077001, outstandingCount: 2, overdueCents: 1067000, overdueCount: 1 });
    if (!("rows" in result)) throw new Error(result.error);
    expect(result.rows.map(r => r.daysOverdue)).toEqual([5, 0]);
    expect(queryCalls).toContainEqual({ table: "invoices", column: "status", value: "sent" });
    expect(queryCalls).toContainEqual({ table: "invoices", column: "user_id", value: "me" });
  });
  it("paginates all sent receivables instead of silently truncating totals", async () => {
    db.invoices = Array.from({ length: 1001 }, (_, i) => ({ id: String(i), user_id: "me", status: "sent", due_date: "2026-01-01", net_amount: "0.01" }));
    expect(await getReceivablesSummary("2026-01-02")).toMatchObject({ outstandingCount: 1001, outstandingCents: 1001, overdueCount: 1001 });
  });
  it("validates loader dates and tax years", async () => {
    expect((await getReceivablesSummary("2026-02-30")).error).toBe(dict.common.invalidInput);
    expect((await getTaxJarSummary(2101)).error).toBe(dict.common.invalidInput);
    expect(queryCalls).toEqual([]);
  });
  it("does not return a misleading zero balance on query failure", async () => {
    failures.push({ table: "invoices", op: "select", error: { message: "offline" } });
    expect((await getReceivablesSummary("2026-01-10")).error).toBeTruthy();
  });
  it("suggests next Buddhist year number; ignores other years/malformed suffixes", () => {
    expect(suggestNextInvoiceNumber([], 2026)).toBe("INV-2569-001");
    expect(suggestNextInvoiceNumber(["INV-2568-999", "INV-2569-002", "INV-2569-010", "INV-2569-abc"], 2026)).toBe("INV-2569-011");
    expect(suggestNextInvoiceNumber(["INV-2569-999"], 2026)).toBe("INV-2569-1000");
  });
  it("accepts zero item price but rejects unsafe aggregate totals", () => {
    expect(invoiceSchema.safeParse({ ...input, items: [{ ...input.items[0], unitPriceCents: 0 }] }).success).toBe(true);
    expect(invoiceSchema.safeParse({ ...input, items: [{ ...input.items[0], unitPriceCents: Number.MAX_SAFE_INTEGER, quantity: 2 }] }).success).toBe(false);
    expect(taxJarSettingsSchema.safeParse({ ratePct: 7.55 }).success).toBe(false);
    expect(taxJarEntrySchema.safeParse({ ...entry, incomeType: "salary" }).success).toBe(false);
  });
});

it("all actions and loaders reject unauthenticated calls with pleaseLogin", async () => {
  user = null;
  const results = await Promise.all([
    createInvoice(input), updateInvoice(ID, input), markInvoiceSent(ID), voidInvoice(ID), markInvoicePaid(paid),
    getTaxJarSettings(), upsertTaxJarSettings({}), addTaxJarEntry(entry), deleteTaxJarEntry(ID), getTaxJarSummary(2026), getReceivablesSummary("2026-01-01"),
  ]);
  expect(results.every(r => r.error === dict.common.pleaseLogin)).toBe(true);
  expect(writes).toEqual([]); expect(rpcCalls).toEqual([]); expect(queryCalls).toEqual([]);
});
