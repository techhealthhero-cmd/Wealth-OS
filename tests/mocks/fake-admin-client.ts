/**
 * A minimal, purpose-built in-memory fake of the Supabase admin client's
 * query-builder surface — grew from `/api/billing/webhook`'s original
 * narrow set (`.eq().maybeSingle()`, `.insert()`, `.update().eq()`) to
 * also cover `/api/cron/ai-checkin`'s needs (`.in()`, `.order()`,
 * `.limit()`, `.single()`) as each route's test needed them. Still not a
 * general Supabase mock — only add a method here once an actual test
 * calls it, so this stays honest about what it verifies.
 */

type Row = Record<string, unknown>;

export interface FakeDb {
  [table: string]: Row[];
}

class FakeQuery implements PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> {
  private filters: [string, unknown][] = [];
  private inFilters: [string, unknown[]][] = [];
  private orderColumn: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;

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

  in(column: string, values: unknown[]): this {
    this.inFilters.push([column, values]);
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orderColumn = column;
    this.orderAscending = opts?.ascending ?? true;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  /** No-op chain method — real Supabase narrows returned columns, this fake always returns full rows. Exists so `.insert(...).select("id").single()` chains type-check and run. */
  select(_columns?: string): this {
    return this;
  }

  private matches(row: Row): boolean {
    return (
      this.filters.every(([col, val]) => row[col] === val) &&
      this.inFilters.every(([col, values]) => values.includes(row[col]))
    );
  }

  async maybeSingle() {
    if (this.op !== "select") return singleFromResult(this.execute());
    const rows = (this.db[this.table] ?? []).filter((r) => this.matches(r));
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    if (this.op !== "select") return singleFromResult(this.execute());
    const rows = (this.db[this.table] ?? []).filter((r) => this.matches(r));
    if (rows.length === 0) return { data: null, error: { message: "no rows" } };
    return { data: rows[0], error: null };
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

    let rows = table.filter((r) => this.matches(r));
    if (this.orderColumn) {
      const col = this.orderColumn;
      rows = [...rows].sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        const cmp = av === bv ? 0 : av! > bv! ? 1 : -1;
        return this.orderAscending ? cmp : -cmp;
      });
    }
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return { data: rows, error: null };
  }
}

function singleFromResult(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  if (result.error) return { data: null, error: result.error };
  const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
  return { data, error: null };
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
