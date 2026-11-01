/**
 * Small in-memory stand-in for the parts of the Supabase query builder the
 * slip inbox uses — never a real database. Records every query so tests can
 * assert each one was scoped by user_id (the service-role path relies on it).
 */

export type Row = Record<string, unknown>;

export interface QueryLog {
  table: string;
  op: string;
  filterColumns: string[];
}

interface UniqueRule {
  table: string;
  columns: string[];
}

const UNIQUE: UniqueRule[] = [
  { table: "slip_inbox", columns: ["user_id", "image_sha256"] },
  { table: "slip_inbox", columns: ["user_id", "reference"] },
  { table: "transactions", columns: ["user_id", "client_request_id"] },
  { table: "capture_tokens", columns: ["token_hash"] },
  { table: "account_aliases", columns: ["user_id", "alias_normalized"] },
];

export class FakeDb {
  tables: Record<string, Row[]> = {};
  log: QueryLog[] = [];
  /** Columns this "database" doesn't have yet (a migration not pushed) — "table.column". */
  missingColumns = new Set<string>();
  /** A CHECK constraint this "database" enforces on writes (Postgres 23514). */
  checkViolation: ((table: string, row: Row) => boolean) | null = null;
  private nextId = 1;

  rows(table: string) {
    return (this.tables[table] ??= []);
  }

  newId() {
    const n = String(this.nextId++).padStart(12, "0");
    return `00000000-0000-4000-8000-${n}`;
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  rpc() {
    return Promise.resolve({ data: true, error: null });
  }

  violatesUnique(table: string, row: Row, ignore?: Row) {
    return UNIQUE.some(
      (u) =>
        u.table === table &&
        u.columns.every((c) => row[c] !== null && row[c] !== undefined) &&
        this.rows(table).some((r) => r !== ignore && u.columns.every((c) => r[c] === row[c]))
    );
  }
}

type Filter = { col: string; test: (r: Row) => boolean };

export class FakeQuery {
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Row | null = null;
  private conflict: string[] = [];
  private columns: string[] = [];
  private limitN = Infinity;
  private countMode = false;
  private returning = false;

  constructor(
    private db: FakeDb,
    private table: string
  ) {}

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") {
      this.countMode = Boolean(opts?.count);
      this.columns = (cols ?? "").split(",").map((c) => c.trim());
    } else this.returning = true;
    return this;
  }
  insert(payload: Row) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row, opts: { onConflict: string }) {
    this.op = "upsert";
    this.payload = payload;
    this.conflict = opts.onConflict.split(",");
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  private add(col: string, test: (r: Row) => boolean) {
    this.filters.push({ col, test });
    return this;
  }
  eq(col: string, val: unknown) {
    return this.add(col, (r) => r[col] === val);
  }
  is(col: string, val: unknown) {
    return this.add(col, (r) => (r[col] ?? null) === val);
  }
  gte(col: string, val: string) {
    return this.add(col, (r) => String(r[col]) >= val);
  }
  lte(col: string, val: string) {
    return this.add(col, (r) => String(r[col]) <= val);
  }
  lt(col: string, val: string) {
    return this.add(col, (r) => String(r[col]) < val);
  }
  in(col: string, vals: unknown[]) {
    return this.add(col, (r) => vals.includes(r[col]));
  }
  /** Only the `a.eq.x,b.eq.y` form the slip code uses. */
  or(expr: string) {
    const parts = expr.split(",").map((p) => p.split(".eq."));
    return this.add(
      parts.map(([c]) => c).join("|"),
      (r) => parts.some(([c, v]) => String(r[c]) === v)
    );
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }

  private run(): { data: Row[] | null; error: { code: string; message: string } | null; count?: number } {
    this.db.log.push({ table: this.table, op: this.op, filterColumns: this.filters.map((f) => f.col) });
    const missing = (cols: string[]) => cols.some((c) => this.db.missingColumns.has(`${this.table}.${c}`));
    if (this.op === "select" && missing(this.columns)) return { data: null, error: { code: "42703", message: "column does not exist" } };
    if (this.op !== "select" && missing(Object.keys(this.payload ?? {}))) {
      return { data: null, error: { code: "PGRST204", message: "column not in schema cache" } };
    }
    if (this.op !== "select" && this.db.checkViolation?.(this.table, this.payload ?? {})) {
      return { data: null, error: { code: "23514", message: "violates check constraint" } };
    }
    const rows = this.db.rows(this.table);
    if (this.op === "upsert") {
      const p = this.payload ?? {};
      const existing = rows.find((r) => this.conflict.every((c) => r[c] === p[c]));
      if (existing) Object.assign(existing, p);
      else rows.push({ id: this.db.newId(), created_at: new Date().toISOString(), ...p });
      return { data: null, error: null };
    }
    if (this.op === "insert") {
      const row: Row = { id: this.db.newId(), created_at: new Date().toISOString(), ...this.payload };
      if (this.db.violatesUnique(this.table, row)) return { data: null, error: { code: "23505", message: "duplicate key" } };
      rows.push(row);
      return { data: [row], error: null };
    }
    const matched = rows.filter((r) => this.filters.every((f) => f.test(r)));
    if (this.op === "update") {
      for (const r of matched) {
        const next = { ...r, ...this.payload };
        if (this.db.violatesUnique(this.table, next, r)) return { data: null, error: { code: "23505", message: "duplicate key" } };
        Object.assign(r, this.payload);
      }
      return { data: this.returning ? matched : null, error: null };
    }
    if (this.countMode) return { data: null, error: null, count: matched.length };
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
  then<T>(onfulfilled: (r: { data: Row[] | null; error: unknown; count?: number }) => T) {
    return Promise.resolve(onfulfilled(this.run()));
  }
}
