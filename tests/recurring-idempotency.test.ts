import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirmRecurringTransaction } from "@/features/recurring/actions";

/**
 * Regression test for the recurring-transaction double-submit race
 * identified during the Financial Data Integrity production-promotion
 * pass: `confirmRecurringTransaction` had no idempotency protection at
 * all, so two rapid clicks on "Confirm" (both reading the same
 * `next_due_date` before either advanced it) could create two real
 * transfers/transactions for one due occurrence.
 *
 * Fixed by deriving a deterministic idempotency key from
 * (recurring.id, next_due_date) via `deterministicUuid()` and reusing the
 * EXACT same database uniqueness mechanism as ordinary transactions
 * (migration 0012's `client_request_id` unique index / `create_transfer`'s
 * `ON CONFLICT` handling) — not a second duplicate-prevention system.
 *
 * Mocks Supabase — never touches a real database.
 */

type Row = Record<string, unknown>;

let recurringRows: Row[];
let transactions: Row[];
let currentUser: { id: string } | null;

function findByKey(userId: string, key: string): Row | undefined {
  return transactions.find((r) => r.user_id === userId && r.client_request_id === key);
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from(table: string) {
      if (table === "recurring_transactions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: recurringRows[0] ?? null, error: null }),
              }),
            }),
          }),
          // Deliberately does NOT mutate `recurringRows[0]` — this isolates
          // the idempotency-key test (does the SAME next_due_date always
          // derive the SAME key?) from the separately-correct due-date-
          // advancement logic. A real double-click race is exactly this:
          // both requests' SELECT happen before either's UPDATE commits, so
          // both see the SAME pre-race next_due_date.
          update: () => ({
            eq: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "transactions") {
        return {
          insert: (payload: Row) => {
            const key = payload.client_request_id as string | null | undefined;
            if (key && findByKey(payload.user_id as string, key)) {
              return Promise.resolve({
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint" },
              });
            }
            transactions.push({ id: `tx-${transactions.length + 1}`, ...payload });
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name !== "create_transfer") throw new Error(`unexpected rpc: ${name}`);
      const key = args.p_client_request_id as string | null | undefined;
      if (key) {
        const existing = findByKey(currentUser!.id, key);
        if (existing) return Promise.resolve({ data: existing, error: null }); // ON CONFLICT ... RETURNING behavior
      }
      const row = {
        id: `tx-${transactions.length + 1}`,
        user_id: currentUser?.id,
        type: "transfer",
        client_request_id: key ?? null,
        from_account_id: args.p_from_account_id,
        to_account_id: args.p_to_account_id,
        amount: args.p_amount,
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

describe("confirmRecurringTransaction — transfer type", () => {
  beforeEach(() => {
    currentUser = { id: "user-1" };
    transactions = [];
    recurringRows = [
      {
        id: "recur-1",
        user_id: "user-1",
        type: "transfer",
        from_account_id: "acc-a",
        to_account_id: "acc-b",
        amount: "1000",
        frequency: "monthly",
        next_due_date: todayISO(),
        end_date: null,
        description: "Rent",
      },
    ];
  });

  it("creates exactly one transfer for a single confirm", async () => {
    await confirmRecurringTransaction("recur-1");
    expect(transactions).toHaveLength(1);
  });

  it("rapid double-confirm (same due occurrence) creates exactly one transfer, not two", async () => {
    // Both calls read next_due_date BEFORE either advances it — the real
    // race a double-click produces. Sequential awaits are enough to prove
    // the fix, since the key is derived from data, not timing.
    await confirmRecurringTransaction("recur-1");
    await confirmRecurringTransaction("recur-1");
    expect(transactions).toHaveLength(1);
  });

  it("confirming a DIFFERENT occurrence (different next_due_date) creates a second, separate transfer", async () => {
    await confirmRecurringTransaction("recur-1");
    // A different (already-due, e.g. previously overdue) occurrence of the
    // same recurring series derives a different key.
    recurringRows[0].next_due_date = "2026-01-01";
    await confirmRecurringTransaction("recur-1");
    expect(transactions).toHaveLength(2);
  });
});

describe("confirmRecurringTransaction — expense type", () => {
  beforeEach(() => {
    currentUser = { id: "user-1" };
    transactions = [];
    recurringRows = [
      {
        id: "recur-2",
        user_id: "user-1",
        type: "expense",
        account_id: "acc-a",
        category_id: null,
        amount: "500",
        frequency: "monthly",
        next_due_date: todayISO(),
        end_date: null,
        merchant: "Netflix",
        description: null,
      },
    ];
  });

  it("creates exactly one transaction for a single confirm", async () => {
    const result = await confirmRecurringTransaction("recur-2");
    expect(result.success).toBe(true);
    expect(transactions).toHaveLength(1);
  });

  it("rapid double-confirm creates exactly one transaction and reports success both times", async () => {
    const first = await confirmRecurringTransaction("recur-2");
    const retry = await confirmRecurringTransaction("recur-2");
    expect(transactions).toHaveLength(1);
    expect(first.success).toBe(true);
    expect(retry.success).toBe(true);
    expect(retry.error).toBeUndefined();
  });
});
