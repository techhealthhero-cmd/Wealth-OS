/**
 * A minimal, purpose-built in-memory fake of the Supabase admin client's
 * query-builder surface — only the exact methods `/api/billing/webhook`
 * actually calls (`from().select().eq().maybeSingle()`,
 * `from().insert()`, `from().update().eq()`, chained `.eq().eq()` for an
 * extra filter). Not a general Supabase mock — intentionally narrow so it
 * stays honest about what it verifies.
 */

type Row = Record<string, unknown>;

export interface FakeDb {
  [table: string]: Row[];
}

class FakeQuery implements PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> {
  private filters: [string, unknown][] = [];

  constructor(
    private db: FakeDb,
    private table: string,
    private op: "select" | "insert" | "update" | "upsert",
    private payload?: Row,
    private opts?: { onConflict?: string }
  ) {}

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every(([col, val]) => row[col] === val);
  }

  async maybeSingle() {
    const rows = (this.db[this.table] ?? []).filter((r) => this.matches(r));
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown; error: { code?: string; message?: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { code?: string; message?: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const result = this.execute();
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  private execute(): { data: unknown; error: { code?: string; message?: string } | null } {
    this.db[this.table] ??= [];
    const table = this.db[this.table];

    if (this.op === "insert") {
      const row = { ...this.payload };
      // Simulate the real unique constraints this test suite cares about:
      // subscriptions(user_id) and billing_events(provider, provider_event_id).
      if (this.table === "billing_events") {
        const dup = table.some((r) => r.provider === row.provider && r.provider_event_id === row.provider_event_id);
        if (dup) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      }
      if (this.table === "subscriptions") {
        const dup = table.some((r) => r.user_id === row.user_id);
        if (dup) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      }
      table.push(row);
      return { data: row, error: null };
    }

    if (this.op === "update") {
      let updated = 0;
      for (const row of table) {
        if (this.matches(row)) {
          Object.assign(row, this.payload);
          updated++;
        }
      }
      return { data: updated, error: null };
    }

    if (this.op === "upsert") {
      const row = { ...this.payload };
      const key = this.opts?.onConflict ?? "id";
      const existing = table.find((r) => r[key] === row[key]);
      if (existing) Object.assign(existing, row);
      else table.push(row);
      return { data: row, error: null };
    }

    return { data: table.filter((r) => this.matches(r)), error: null };
  }
}

/** A stand-in for `createAdminClient()`'s return value, backed by an in-memory `FakeDb` the test can inspect directly. */
export function createFakeAdminClient(db: FakeDb) {
  return {
    from(table: string) {
      return {
        select: () => new FakeQuery(db, table, "select"),
        insert: (payload: Row) => new FakeQuery(db, table, "insert", payload),
        update: (payload: Row) => new FakeQuery(db, table, "update", payload),
        upsert: (payload: Row, opts?: { onConflict?: string }) => new FakeQuery(db, table, "upsert", payload, opts),
      };
    },
  };
}
