import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prepareStatementImportSchema, statementImportBatchIdSchema } from "@/lib/validation/statement-import";

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

  it("creates staging batches and rows atomically", () => {
    const atomicSql = readFileSync(resolve("supabase/migrations/0030_atomic_statement_import_staging.sql"), "utf8");
    expect(atomicSql).toContain("create_statement_import_batch");
    expect(atomicSql).toContain("SECURITY INVOKER");
    expect(atomicSql).toContain("jsonb_array_elements");
    expect(atomicSql).toContain("auth.uid()");
  });

  it("keeps cross-user account and transaction relationships behind ownership checks", () => {
    expect(sql).toContain("a.user_id = auth.uid()");
    expect(sql).toContain("t.user_id = auth.uid()");
    expect(sql).toContain("transaction_import_rows_batch_owner_fk");
  });
});

const batchId = "11111111-1111-4111-8111-111111111111";
const mapping = { date: "Date", description: "Description", amount: "Amount" };

describe("statement import input schemas", () => {
  it("accepts a UUID and a valid column mapping", () => {
    expect(statementImportBatchIdSchema.parse(batchId)).toBe(batchId);
    expect(prepareStatementImportSchema.parse({ batchId, mapping })).toEqual({ batchId, mapping });
  });

  it.each(["", "not-a-uuid", "11111111111141118111111111111111", null, undefined, 123])(
    "rejects invalid batch ID %j in both schemas", (invalidId) => {
      expect(statementImportBatchIdSchema.safeParse(invalidId).success).toBe(false);
      expect(prepareStatementImportSchema.safeParse({ batchId: invalidId, mapping }).success).toBe(false);
    }
  );

  it.each([undefined, null, {}, { ...mapping, date: "" }, { ...mapping, debit: "Debit" }])(
    "rejects missing or invalid nested mapping %j", (invalidMapping) => {
      expect(prepareStatementImportSchema.safeParse({ batchId, mapping: invalidMapping }).success).toBe(false);
    }
  );
});
