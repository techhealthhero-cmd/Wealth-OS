import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTransaction, createTransfer } from "@/features/transactions/actions";

/**
 * Regression tests for transaction idempotency (see CLAUDE.md "TRANSACTION
 * IDEMPOTENCY"). A client-generated idempotency key (`client_request_id`)
 * is enforced by a real database unique constraint (migration 0012, now
 * applied everywhere this app runs — staging and production) — modeled
 * here as an atomic check inside the mock's `insert`/`rpc`, exactly like a
 * Postgres unique index would enforce it as part of the write itself, not
 * as a separate read-then-write step.
 *
 * The pre-migration heuristic fallback (and its tests) were removed once
 * migration 0012 was confirmed applied to every environment this app
 * targets — see PROJECT_STATUS.md's "Production status — MIGRATED" entry.
 *
 * Mocks Supabase — never touches a real database.
 */

type Row = Record<string, unknown>;

let transactions: Row[];
let currentUser: { id: string } | null;
let nextId = 1;

function matches(row: Row, filters: [string, unknown][]): boolean {
  return filters.every(([col, val]) => {
    if (col.startsWith("gte:")) return (row[col.slice(4)] as string) >= (val as string);
    if (col.startsWith("in:")) return (val as string[]).includes(row.id as string);
    return row[col] === val;
  });
}

function makeSelectBuilder() {
  const filters: [string, unknown][] = [];
  const builder = {
    eq(col: string, val: unknown) {
      filters.push([col, val]);
      return builder;
    },
    gte(col: string, val: unknown) {
      filters.push([`gte:${col}`, val]);
      return builder;
    },
    in(col: string, vals: unknown[]) {
      filters.push([`in:${col}`, vals]);
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    then(onfulfilled: (r: { data: Row[]; error: null }) => unknown) {
      const rows = transactions.filter((r) => matches(r, filters));
      return Promise.resolve(onfulfilled({ data: rows, error: null }));
    },
  };
  return builder;
}

/** Mirrors migration 0012's `unique(user_id, client_request_id) where client_request_id is not null`. */
function findByIdempotencyKey(userId: string, key: string): Row | undefined {
  return transactions.find((r) => r.user_id === userId && r.client_request_id === key);
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from(table: string) {
      if (table !== "transactions") throw new Error(`unexpected table: ${table}`);
      return {
        select: () => makeSelectBuilder(),
        insert: (payload: Row) => {
          const key = payload.client_request_id as string | null | undefined;
          if (key) {
            const existing = findByIdempotencyKey(payload.user_id as string, key);
            if (existing) {
              return Promise.resolve({
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint" },
              });
            }
          }
          const row = { id: `tx-${nextId++}`, created_at: new Date().toISOString(), ...payload };
          transactions.push(row);
          return Promise.resolve({ data: row, error: null });
        },
      };
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name !== "create_transfer") throw new Error(`unexpected rpc: ${name}`);
      const key = args.p_client_request_id as string | null | undefined;
      if (key) {
        const existing = findByIdempotencyKey(currentUser!.id, key);
        // Mirrors `ON CONFLICT ... DO UPDATE ... RETURNING` — a retried
        // attempt returns the ALREADY-CREATED row, atomically, never a
        // second insert.
        if (existing) return Promise.resolve({ data: existing, error: null });
      }
      const row = {
        id: `tx-${nextId++}`,
        created_at: new Date().toISOString(),
        user_id: currentUser?.id,
        client_request_id: key ?? null,
        type: "transfer",
        from_account_id: args.p_from_account_id,
        to_account_id: args.p_to_account_id,
        amount: args.p_amount,
        transaction_date: args.p_transaction_date,
        description: args.p_description ?? null,
      };
      transactions.push(row);
      return Promise.resolve({ data: row, error: null });
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

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";

function expenseFormData(opts: { clientRequestId?: string } = {}) {
  const fd = new FormData();
  fd.set("type", "expense");
  fd.set("account_id", ACCOUNT_A);
  fd.set("amount", "150");
  fd.set("transaction_date", "2026-09-16");
  fd.set("merchant", "7-Eleven");
  if (opts.clientRequestId) fd.set("client_request_id", opts.clientRequestId);
  return fd;
}

function transferFormData(opts: { clientRequestId?: string } = {}) {
  const fd = new FormData();
  fd.set("from_account_id", ACCOUNT_A);
  fd.set("to_account_id", ACCOUNT_B);
  fd.set("amount", "500");
  fd.set("transaction_date", "2026-09-16");
  if (opts.clientRequestId) fd.set("client_request_id", opts.clientRequestId);
  return fd;
}

describe("createTransaction — idempotency key", () => {
  beforeEach(() => {
    transactions = [];
    currentUser = { id: "user-1" };
    nextId = 1;
  });

  it("creates exactly one row for a single submission", async () => {
    await createTransaction(undefined, expenseFormData({ clientRequestId: "req-1" }));
    expect(transactions).toHaveLength(1);
  });

  it("Scenario A/D: the same key resubmitted (retry after success, or a rapid double-click) creates exactly one row and reports success, not an error", async () => {
    const first = await createTransaction(undefined, expenseFormData({ clientRequestId: "req-1" }));
    const retry = await createTransaction(undefined, expenseFormData({ clientRequestId: "req-1" }));
    expect(transactions).toHaveLength(1);
    // Phase 5: "Do not return an alarming generic error if the original
    // request succeeded" — the retry must look like success to the client,
    // not surface the underlying unique-constraint violation.
    expect(first.success).toBe(true);
    expect(retry.success).toBe(true);
    expect(retry.error).toBeUndefined();
  });

  it("Scenario B: two requests with the SAME key racing concurrently still create exactly one row (atomic DB constraint, not a check-then-act window)", async () => {
    await Promise.all([
      createTransaction(undefined, expenseFormData({ clientRequestId: "req-race" })),
      createTransaction(undefined, expenseFormData({ clientRequestId: "req-race" })),
    ]);
    expect(transactions).toHaveLength(1);
  });

  it("Scenario C: two genuinely separate identical-looking transactions with DIFFERENT keys both get created", async () => {
    await createTransaction(undefined, expenseFormData({ clientRequestId: "req-1" }));
    await createTransaction(undefined, expenseFormData({ clientRequestId: "req-2" }));
    expect(transactions).toHaveLength(2);
  });

  it("user-scoped: two different users using the same key value do not collide", async () => {
    currentUser = { id: "user-1" };
    await createTransaction(undefined, expenseFormData({ clientRequestId: "shared-key" }));
    currentUser = { id: "user-2" };
    await createTransaction(undefined, expenseFormData({ clientRequestId: "shared-key" }));
    expect(transactions).toHaveLength(2);
  });

  it("Scenario F: an old caller with no key at all still saves successfully (backward compatible, unprotected for that one call)", async () => {
    await createTransaction(undefined, expenseFormData());
    await createTransaction(undefined, expenseFormData());
    // No key on either call means neither can be recognized as a retry of
    // the other — this is the documented, accepted behavior for a caller
    // that predates this feature, not a regression.
    expect(transactions).toHaveLength(2);
  });
});

describe("createTransfer — idempotency key", () => {
  beforeEach(() => {
    transactions = [];
    currentUser = { id: "user-1" };
    nextId = 1;
  });

  it("Scenario E: a retried transfer (same key) produces exactly one debit/credit effect, not two, and reports success both times", async () => {
    const first = await createTransfer(undefined, transferFormData({ clientRequestId: "transfer-1" }));
    const retry = await createTransfer(undefined, transferFormData({ clientRequestId: "transfer-1" }));
    expect(transactions).toHaveLength(1);
    expect(first.success).toBe(true);
    expect(retry.success).toBe(true);
    expect(retry.error).toBeUndefined();
  });

  it("concurrent identical-key transfer requests still produce exactly one row", async () => {
    await Promise.all([
      createTransfer(undefined, transferFormData({ clientRequestId: "transfer-race" })),
      createTransfer(undefined, transferFormData({ clientRequestId: "transfer-race" })),
    ]);
    expect(transactions).toHaveLength(1);
  });

  it("two separate transfers with different keys both get created", async () => {
    await createTransfer(undefined, transferFormData({ clientRequestId: "t-1" }));
    await createTransfer(undefined, transferFormData({ clientRequestId: "t-2" }));
    expect(transactions).toHaveLength(2);
  });
});
