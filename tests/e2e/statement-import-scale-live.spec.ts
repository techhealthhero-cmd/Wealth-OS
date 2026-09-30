import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function localEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function client(key: "SUPABASE_SERVICE_ROLE_KEY" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): SupabaseClient {
  const env = localEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env[key], {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test("database import scale: 10, 100 and 1,000 rows confirm and rollback exactly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "Run scale integration once");
  test.setTimeout(240_000);
  const admin = client("SUPABASE_SERVICE_ROLE_KEY");
  const userApi = client("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-import-scale-${stamp}@example.com`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    const { data: account, error: accountError } = await admin.from("accounts").insert({
      user_id: userId,
      name: "Scale account",
      account_type: "bank",
      currency_code: "THB",
      opening_balance: "100000.00",
    }).select("id").single();
    expect(accountError).toBeNull();
    expect((await userApi.auth.signInWithPassword({ email, password })).error).toBeNull();

    for (const rowCount of [10, 100, 1_000]) {
      const rawRows = Array.from({ length: rowCount }, (_, index) => ({
        date: "2026-09-30",
        description: index % 10 === 0 ? `Scale income ${index}` : `Scale expense ${index}`,
        amount: index % 10 === 0 ? "1000.00" : "10.00",
        type: index % 10 === 0 ? "income" : "expense",
        reference: `SCALE-${rowCount}-${index}-${stamp}`,
      }));
      const hash = createHash("sha256").update(JSON.stringify(rawRows)).digest("hex");
      const stageStarted = Date.now();
      const { data: batchData, error: stageError } = await userApi.rpc("create_statement_import_batch", {
        p_account_id: account!.id,
        p_filename: `scale-${rowCount}.csv`,
        p_content_hash: hash,
        p_rows: rawRows,
      });
      expect(stageError).toBeNull();
      const batch = Array.isArray(batchData) ? batchData[0] : batchData;
      const stageMs = Date.now() - stageStarted;

      const { data: rows, error: rowsError } = await userApi
        .from("transaction_import_rows")
        .select("*")
        .eq("batch_id", batch.id)
        .order("row_number");
      expect(rowsError).toBeNull();
      expect(rows).toHaveLength(rowCount);
      const previewStarted = Date.now();
      const prepared = rows!.map((row, index) => ({
        ...row,
        status: "ready",
        fingerprint: createHash("sha256").update(`fp-${rowCount}-${index}-${stamp}`).digest("hex"),
        normalized_data: {
          type: index % 10 === 0 ? "income" : "expense",
          amount: index % 10 === 0 ? "1000.00" : "10.00",
          amountCents: index % 10 === 0 ? 100000 : 1000,
          date: "2026-09-30",
          description: rawRows[index].description,
          merchant: rawRows[index].description,
          reference: rawRows[index].reference,
          currencyCode: "THB",
          categoryId: null,
          categorySource: null,
          reviewRequired: false,
          fingerprint: createHash("sha256").update(`fp-${rowCount}-${index}-${stamp}`).digest("hex"),
        },
      }));
      for (let offset = 0; offset < prepared.length; offset += 250) {
        expect((await userApi.from("transaction_import_rows").upsert(prepared.slice(offset, offset + 250), { onConflict: "id" })).error).toBeNull();
      }
      expect((await userApi.from("transaction_import_batches").update({ status: "ready" }).eq("id", batch.id)).error).toBeNull();
      const previewMs = Date.now() - previewStarted;

      const confirmStarted = Date.now();
      const confirmed = await userApi.rpc("confirm_statement_import", { p_batch_id: batch.id });
      const confirmMs = Date.now() - confirmStarted;
      expect(confirmed.error).toBeNull();
      const result = Array.isArray(confirmed.data) ? confirmed.data[0] : confirmed.data;
      expect(result.imported_count).toBe(rowCount);
      const expectedDelta = (rowCount / 10) * (1000 - 9 * 10);
      const { data: afterConfirm } = await admin.from("accounts").select("current_balance").eq("id", account!.id).single();
      expect(Number(afterConfirm!.current_balance)).toBe(100_000 + expectedDelta);

      const rollbackStarted = Date.now();
      const rolledBack = await userApi.rpc("rollback_statement_import", { p_batch_id: batch.id });
      const rollbackMs = Date.now() - rollbackStarted;
      expect(rolledBack.error).toBeNull();
      expect(Number(rolledBack.data)).toBe(rowCount);
      const { data: afterRollback } = await admin.from("accounts").select("current_balance").eq("id", account!.id).single();
      expect(Number(afterRollback!.current_balance)).toBe(100_000);
      console.log(`[IMPORT_SCALE] rows=${rowCount} stage_ms=${stageMs} preview_write_ms=${previewMs} confirm_ms=${confirmMs} rollback_ms=${rollbackMs}`);
    }
  } finally {
    await page.goto("about:blank").catch(() => {});
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (userId) {
      expect((await admin.from("transaction_import_batches").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);
      expect((await admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId)).count).toBe(0);
    }
  }
});

