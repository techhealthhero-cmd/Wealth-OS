import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkCaptureDuplicate,
  confirmInboxTransaction,
  dismissRecurringSuggestion,
  saveCapturedTransaction,
} from "@/features/capture/actions";

/**
 * Quick Capture server actions against an in-memory Supabase fake (never a
 * real database). `migrated = false` simulates a database where migration
 * 0021 isn't applied yet: any write touching its new columns fails with
 * PostgREST's unknown-column error, like the real API would.
 */

type Row = Record<string, unknown>;
let db: Record<string, Row[]>;
let currentUser: { id: string } | null;
let migrated: boolean;
let nextId: number;

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
const SUBS = "44444444-4444-4444-8444-444444444444";
const key = () => crypto.randomUUID();

const BASE = {
  type: "expense" as const,
  amountCents: 8000,
  accountId: ACCOUNT,
  categoryId: FOOD,
  merchant: "ข้าว",
  description: null,
  date: "2026-09-29",
  source: "quick_text" as const,
  confidence: "high" as const,
  categoryConfirmedByUser: false,
};

beforeEach(() => {
  db = {};
  currentUser = { id: "user-1" };
  migrated = true;
  nextId = 1;
});

describe("saveCapturedTransaction", () => {
  it("saves a high-confidence capture as confirmed and learns the category", async () => {
    const res = await saveCapturedTransaction({ ...BASE, clientRequestId: key() });
    expect(res.success).toBe(true);
    expect(db.transactions).toHaveLength(1);
    expect(db.transactions[0]).toMatchObject({
      user_id: "user-1",
      amount: "80.00",
      source: "quick_text",
      review_status: "confirmed",
      ai_confidence: "high",
      merchant: "ข้าว",
    });
    expect(db.merchant_category_preferences).toEqual([
      expect.objectContaining({ user_id: "user-1", merchant_normalized: "ข้าว", category_id: FOOD }),
    ]);
  });

  it("puts a guessed (medium) capture in the inbox and does NOT learn from it", async () => {
    await saveCapturedTransaction({ ...BASE, confidence: "medium", clientRequestId: key() });
    expect(db.transactions[0].review_status).toBe("needs_review");
    expect(db.merchant_category_preferences ?? []).toHaveLength(0);
  });

  it("a category the user picked counts as confirmed even at medium confidence", async () => {
    await saveCapturedTransaction({ ...BASE, confidence: "medium", categoryConfirmedByUser: true, clientRequestId: key() });
    expect(db.transactions[0].review_status).toBe("confirmed");
    expect(db.merchant_category_preferences).toHaveLength(1);
  });

  it("learning increments usage for a repeated merchant", async () => {
    await saveCapturedTransaction({ ...BASE, clientRequestId: key() });
    await saveCapturedTransaction({ ...BASE, clientRequestId: key() });
    expect(db.merchant_category_preferences).toHaveLength(1);
    expect(db.merchant_category_preferences[0].usage_count).toBe(2);
  });

  it("a retried tap (same key) never creates a second row", async () => {
    const k = key();
    const first = await saveCapturedTransaction({ ...BASE, clientRequestId: k });
    const retry = await saveCapturedTransaction({ ...BASE, clientRequestId: k });
    expect(first.success && retry.success).toBe(true);
    expect(db.transactions).toHaveLength(1);
  });

  it("two separate identical captures are both saved", async () => {
    await saveCapturedTransaction({ ...BASE, clientRequestId: key() });
    await saveCapturedTransaction({ ...BASE, clientRequestId: key() });
    expect(db.transactions).toHaveLength(2);
  });

  it("still saves on a database without migration 0021 (pre-0021 shape)", async () => {
    migrated = false;
    const res = await saveCapturedTransaction({ ...BASE, clientRequestId: key() });
    expect(res.success).toBe(true);
    expect(db.transactions).toHaveLength(1);
    expect(db.transactions[0].source).toBe("manual");
    expect(db.transactions[0]).not.toHaveProperty("review_status");
  });

  it("rejects an unauthenticated call and invalid payloads", async () => {
    currentUser = null;
    expect((await saveCapturedTransaction({ ...BASE, clientRequestId: key() })).error).toBeTruthy();
    currentUser = { id: "user-1" };
    expect((await saveCapturedTransaction({ ...BASE, amountCents: 0, clientRequestId: key() })).error).toBeTruthy();
    expect((await saveCapturedTransaction({ ...BASE, date: "tomorrow", clientRequestId: key() })).error).toBeTruthy();
    expect(db.transactions ?? []).toHaveLength(0);
  });

  it("never trusts a client user id — rows always belong to the session user", async () => {
    await saveCapturedTransaction({ ...BASE, clientRequestId: key(), ...({ user_id: "attacker" } as object) });
    expect(db.transactions[0].user_id).toBe("user-1");
  });
});

describe("recurring suggestion", () => {
  function seedNetflix(dates: string[]) {
    db.transactions = dates.map((d, i) => ({
      id: `n-${i}`,
      user_id: "user-1",
      type: "expense",
      amount: "419.00",
      transaction_date: d,
      merchant: "Netflix",
    }));
  }
  const NETFLIX = { ...BASE, merchant: "Netflix", categoryId: SUBS, amountCents: 41900 };

  it("suggests setting a monthly expense as recurring (never creates it)", async () => {
    seedNetflix(["2026-07-29", "2026-08-29"]);
    const res = await saveCapturedTransaction({ ...NETFLIX, clientRequestId: key() });
    expect(res.recurringSuggestion).toMatchObject({ merchant: "Netflix", amountCents: 41900, frequency: "monthly" });
    expect(db.recurring_transactions ?? []).toHaveLength(0);
  });

  it("stays quiet after the user said 'not recurring'", async () => {
    seedNetflix(["2026-07-29", "2026-08-29"]);
    await dismissRecurringSuggestion({ merchant: "Netflix", amountCents: 41900, frequency: "monthly" });
    const res = await saveCapturedTransaction({ ...NETFLIX, clientRequestId: key() });
    expect(res.recurringSuggestion).toBeNull();
  });

  it("no suggestion for a one-off merchant", async () => {
    const res = await saveCapturedTransaction({ ...BASE, clientRequestId: key() });
    expect(res.recurringSuggestion).toBeNull();
  });
});

describe("confirmInboxTransaction", () => {
  it("marks reviewed, applies a corrected category, and learns it", async () => {
    await saveCapturedTransaction({ ...BASE, merchant: "Grab", categoryId: null, confidence: "medium", clientRequestId: key() });
    const id = db.transactions[0].id as string;
    const res = await confirmInboxTransaction(id, FOOD);
    expect(res.success).toBe(true);
    expect(db.transactions[0]).toMatchObject({ review_status: "confirmed", category_id: FOOD });
    expect(db.merchant_category_preferences).toEqual([expect.objectContaining({ merchant_normalized: "grab", category_id: FOOD })]);
  });

  it("cannot confirm another user's transaction", async () => {
    db.transactions = [{ id: "other", user_id: "user-2", review_status: "needs_review" }];
    const res = await confirmInboxTransaction("other");
    expect(res.error).toBeTruthy();
    expect(db.transactions[0].review_status).toBe("needs_review");
  });
});

describe("checkCaptureDuplicate", () => {
  beforeEach(() => {
    db.transactions = [
      { id: "t1", user_id: "user-1", amount: "249.00", transaction_date: "2026-09-29", merchant: "KFC", description: null, reference: "REF123" },
      { id: "t2", user_id: "user-2", amount: "99.00", transaction_date: "2026-09-29", merchant: "KFC", description: null, reference: null },
    ];
  });

  it("matches on reference number", async () => {
    expect((await checkCaptureDuplicate({ amountCents: 1, date: "2026-01-01", merchant: null, reference: "REF123" }))?.id).toBe("t1");
  });

  it("matches same amount within ±1 day and similar merchant", async () => {
    expect((await checkCaptureDuplicate({ amountCents: 24900, date: "2026-09-30", merchant: "kfc" }))?.id).toBe("t1");
  });

  it("does not flag a different merchant, a different day, or another user's row", async () => {
    expect(await checkCaptureDuplicate({ amountCents: 24900, date: "2026-09-29", merchant: "Starbucks" })).toBeNull();
    expect(await checkCaptureDuplicate({ amountCents: 24900, date: "2026-10-05", merchant: "KFC" })).toBeNull();
    expect(await checkCaptureDuplicate({ amountCents: 9900, date: "2026-09-29", merchant: "KFC" })).toBeNull();
  });
});
