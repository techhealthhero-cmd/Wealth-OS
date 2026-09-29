import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(resolve("supabase/migrations/0029_statement_csv_import.sql"), "utf8");

describe("statement import database boundary", () => {
  it("uses staging tables, RLS and existing transactions as the ledger", () => {
    expect(sql).toContain("create table public.transaction_import_batches");
    expect(sql).toContain("create table public.transaction_import_rows");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("user_id = auth.uid()");
    expect(sql).toContain("insert into public.transactions");
    expect(sql).toContain("'import'");
  });

  it("makes confirmation idempotent and rollback batch-scoped", () => {
    expect(sql).toContain("client_request_id");
    expect(sql).toContain("on conflict (user_id, client_request_id)");
    expect(sql).toContain("r.batch_id = p_batch_id");
    expect(sql).toContain("t.source = 'import'");
    expect(sql).toContain("t.client_request_id = r.id");
  });

  it("keeps cross-user account and transaction relationships behind ownership checks", () => {
    expect(sql).toContain("a.user_id = auth.uid()");
    expect(sql).toContain("t.user_id = auth.uid()");
    expect(sql).toContain("transaction_import_rows_batch_owner_fk");
  });
});

