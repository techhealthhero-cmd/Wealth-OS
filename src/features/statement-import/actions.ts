"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getAccountPrivacyState } from "@/features/account-privacy/queries";
import { isPrivacyLockedFor } from "@/features/account-privacy/types";
import { parseStatementCsv, detectHeaderMapping, CsvParseError, CSV_IMPORT_MAX_BYTES } from "@/lib/import/csv";
import { createImportFingerprint, normalizeImportRow, type NormalizedImportRow } from "@/lib/import/normalize";
import { friendlyDbError } from "@/lib/db-error";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { prepareStatementImportSchema, statementImportBatchIdSchema } from "@/lib/validation/statement-import";
import type {
  TransactionImportBatch,
  TransactionImportRow,
  TransactionImportRowStatus,
} from "@/types/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ImportPreviewRow {
  id: string;
  rowNumber: number;
  status: TransactionImportRowStatus;
  errorCode: string | null;
  existingTransactionId: string | null;
  normalized: NormalizedImportRow | null;
}

export interface ImportPreview {
  batch: TransactionImportBatch;
  rows: ImportPreviewRow[];
}

export type ImportActionResult<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true } & T)
  | { success: false; error: string; code?: string };

async function authorizeImport() {
  const [user, privacy] = await Promise.all([getAuthUser(), getAccountPrivacyState()]);
  if (!user) return { error: "กรุณาเข้าสู่ระบบ / Please sign in" } as const;
  if (isPrivacyLockedFor(privacy, ["accounts", "activity"])) {
    return { error: "ข้อมูลการเงินถูกป้องกันอยู่ / Financial data is protected" } as const;
  }
  return { user, supabase: await createClient() } as const;
}

function safeFilename(name: string): string {
  return name.replace(/[\u0000-\u001f\\/]/g, "_").trim().slice(0, 180) || "statement.csv";
}

function csvError<T = undefined>(error: unknown): ImportActionResult<T> {
  if (error instanceof CsvParseError) return { success: false, error: error.message, code: error.code };
  return { success: false, error: "ไม่สามารถอ่านไฟล์ CSV ได้ / Unable to read CSV" };
}

export async function createStatementImport(formData: FormData): Promise<ImportActionResult<{
  batchId: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  detectedMapping: Record<string, string | null | undefined>;
  rowCount: number;
}>> {
  const auth = await authorizeImport();
  if ("error" in auth) return { success: false, error: auth.error ?? "Unauthorized" };

  const file = formData.get("file");
  const accountId = String(formData.get("accountId") ?? "");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) {
    return { success: false, error: "รองรับเฉพาะไฟล์ CSV / CSV files only", code: "invalid_file" };
  }
  if (file.size === 0 || file.size > CSV_IMPORT_MAX_BYTES) {
    return { success: false, error: "ไฟล์ต้องมีขนาดไม่เกิน 750 KB / File must be 750 KB or smaller", code: "file_too_large" };
  }
  if (!UUID_RE.test(accountId)) return { success: false, error: "กรุณาเลือกบัญชี / Choose an account", code: "invalid_account" };

  const { data: account } = await auth.supabase
    .from("accounts")
    .select("id, currency_code, is_archived")
    .eq("id", accountId)
    .eq("user_id", auth.user.id)
    .eq("is_archived", false)
    .maybeSingle();
  if (!account) return { success: false, error: "ไม่พบบัญชีที่เลือก / Account unavailable", code: "invalid_account" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  let parsed;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = parseStatementCsv(text, bytes.byteLength);
  } catch (error) {
    return csvError(error);
  }

  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const { data: batch, error: batchError } = await auth.supabase
    .from("transaction_import_batches")
    .insert({
      user_id: auth.user.id,
      account_id: accountId,
      filename: safeFilename(file.name),
      content_hash: contentHash,
      row_count: parsed.rows.length,
    })
    .select("*")
    .single();
  if (batchError || !batch) {
    return { success: false, error: batchError ? friendlyDbError(batchError, "statementImport.createBatch", "สร้างรายการนำเข้าไม่สำเร็จ") : "สร้างรายการนำเข้าไม่สำเร็จ" };
  }

  const insertRows = parsed.rows.map((raw, index) => ({
    batch_id: batch.id,
    user_id: auth.user.id,
    row_number: index + 1,
    raw_data: raw,
  }));
  for (let offset = 0; offset < insertRows.length; offset += 250) {
    const { error } = await auth.supabase.from("transaction_import_rows").insert(insertRows.slice(offset, offset + 250));
    if (error) {
      await auth.supabase.from("transaction_import_batches").delete().eq("id", batch.id).eq("user_id", auth.user.id);
      return { success: false, error: friendlyDbError(error, "statementImport.createRows", "บันทึกแถว CSV ไม่สำเร็จ") };
    }
  }

  return {
    success: true,
    batchId: batch.id,
    headers: parsed.headers,
    sampleRows: parsed.rows.slice(0, 3),
    detectedMapping: detectHeaderMapping(parsed.headers),
    rowCount: parsed.rows.length,
  };
}

interface ExistingTransaction {
  id: string;
  type: "income" | "expense";
  amount: string;
  currency_code: string;
  transaction_date: string;
  description: string | null;
  merchant: string | null;
  reference: string | null;
}

function previewRow(row: TransactionImportRow): ImportPreviewRow {
  return {
    id: row.id,
    rowNumber: row.row_number,
    status: row.status,
    errorCode: row.error_code,
    existingTransactionId: row.existing_transaction_id,
    normalized: row.normalized_data as unknown as NormalizedImportRow | null,
  };
}

export async function prepareStatementImport(input: unknown): Promise<ImportActionResult<ImportPreview>> {
  const parsedInput = prepareStatementImportSchema.safeParse(input);
  if (!parsedInput.success) return { success: false, error: "การจับคู่คอลัมน์ไม่ครบ / Column mapping is incomplete", code: "invalid_mapping" };
  const auth = await authorizeImport();
  if ("error" in auth) return { success: false, error: auth.error ?? "Unauthorized" };

  const { batchId, mapping } = parsedInput.data;
  const [{ data: batch }, { data: rows }, categoriesResult, preferencesResult] = await Promise.all([
    auth.supabase.from("transaction_import_batches").select("*").eq("id", batchId).eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("transaction_import_rows").select("*").eq("batch_id", batchId).eq("user_id", auth.user.id).order("row_number"),
    auth.supabase.from("categories").select("id, name_th, name_en, type, icon, is_system"),
    auth.supabase.from("merchant_category_preferences").select("merchant_normalized, category_id").order("usage_count", { ascending: false }).limit(500),
  ]);
  if (!batch || !rows || !["draft", "ready"].includes(batch.status)) {
    return { success: false, error: "ไม่พบรายการนำเข้า / Import batch unavailable" };
  }
  const { data: account } = await auth.supabase
    .from("accounts")
    .select("id, currency_code")
    .eq("id", batch.account_id)
    .eq("user_id", auth.user.id)
    .eq("is_archived", false)
    .maybeSingle();
  if (!account) return { success: false, error: "บัญชีปลายทางไม่พร้อมใช้งาน / Target account unavailable" };

  const headers = Object.keys((rows[0]?.raw_data as Record<string, string> | undefined) ?? {});
  const mappedHeaders = Object.values(mapping).filter((value): value is string => Boolean(value));
  if (mappedHeaders.some((header) => !headers.includes(header))) {
    return { success: false, error: "คอลัมน์ที่เลือกไม่มีในไฟล์ / A mapped column is missing", code: "invalid_mapping" };
  }

  const normalizedResults = rows.map((row: TransactionImportRow) => ({
    row,
    result: normalizeImportRow(row.raw_data, mapping, {
      accountId: account.id,
      accountCurrency: account.currency_code,
      categories: categoriesResult.data ?? [],
      merchantPreferences: preferencesResult.data ?? [],
    }),
  }));
  const valid = normalizedResults.filter((entry) => entry.result.status !== "error");
  const dates = valid.map((entry) => entry.result.status === "error" ? "" : entry.result.normalized.date).sort();
  const references = [...new Set(valid.flatMap((entry) => entry.result.status === "error" || !entry.result.normalized.reference ? [] : [entry.result.normalized.reference]))];

  let existing: ExistingTransaction[] = [];
  if (dates.length) {
    const { data } = await auth.supabase
      .from("transactions")
      .select("id, type, amount, currency_code, transaction_date, description, merchant, reference")
      .eq("user_id", auth.user.id)
      .eq("account_id", account.id)
      .in("type", ["income", "expense"])
      .gte("transaction_date", dates[0])
      .lte("transaction_date", dates[dates.length - 1])
      .limit(5_000);
    existing = (data ?? []) as ExistingTransaction[];
  }
  // Exact same file/account previously confirmed: row position links to the
  // previously created transaction and guarantees a second upload is safe.
  const { data: previousBatch } = await auth.supabase
    .from("transaction_import_batches")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("account_id", account.id)
    .eq("content_hash", batch.content_hash)
    .eq("status", "confirmed")
    .neq("id", batch.id)
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousByRow = new Map<number, string>();
  if (previousBatch) {
    const { data } = await auth.supabase
      .from("transaction_import_rows")
      .select("row_number, transaction_id")
      .eq("batch_id", previousBatch.id)
      .not("transaction_id", "is", null);
    for (const row of data ?? []) if (row.transaction_id) previousByRow.set(row.row_number, row.transaction_id);
  }

  const existingByReference = new Map(existing.filter((t) => t.reference).map((t) => [t.reference!, t.id]));
  // Include reference matches outside the date window without N+1 queries.
  for (let offset = 0; offset < references.length; offset += 100) {
    const { data } = await auth.supabase
      .from("transactions")
      .select("id, reference")
      .eq("user_id", auth.user.id)
      .in("reference", references.slice(offset, offset + 100));
    for (const row of data ?? []) if (row.reference) existingByReference.set(row.reference, row.id);
  }
  const existingByFingerprint = new Map<string, string>();
  for (const transaction of existing) {
    existingByFingerprint.set(createImportFingerprint({
      accountId: account.id,
      currencyCode: transaction.currency_code,
      date: transaction.transaction_date,
      amount: Number(transaction.amount).toFixed(2),
      type: transaction.type,
      merchant: transaction.merchant || transaction.description || "",
    }), transaction.id);
  }

  const seenReferences = new Set<string>();
  const updates = normalizedResults.map(({ row, result }) => {
    if (result.status === "error") {
      return { ...row, normalized_data: null, status: "error", error_code: result.errorCode, fingerprint: null, existing_transaction_id: null };
    }
    const normalized = result.normalized;
    const previousId = previousByRow.get(row.row_number);
    const repeatedReference = Boolean(normalized.reference && seenReferences.has(normalized.reference));
    const referenceId = normalized.reference ? existingByReference.get(normalized.reference) : undefined;
    const fingerprintId = existingByFingerprint.get(normalized.fingerprint);
    const duplicateId = previousId ?? referenceId ?? fingerprintId ?? null;
    if (normalized.reference) seenReferences.add(normalized.reference);
    return {
      ...row,
      normalized_data: normalized,
      status: duplicateId || repeatedReference ? "duplicate" : result.status,
      error_code: null,
      fingerprint: normalized.fingerprint,
      existing_transaction_id: duplicateId,
    };
  });

  for (let offset = 0; offset < updates.length; offset += 250) {
    const { error } = await auth.supabase.from("transaction_import_rows").upsert(updates.slice(offset, offset + 250), { onConflict: "id" });
    if (error) return { success: false, error: friendlyDbError(error, "statementImport.prepareRows", "เตรียมรายการไม่สำเร็จ") };
  }
  const counts = updates.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {} as Record<string, number>);
  const { data: updatedBatch, error: updateError } = await auth.supabase
    .from("transaction_import_batches")
    .update({
      status: "ready",
      header_mapping: mapping,
      skipped_count: counts.duplicate ?? 0,
      review_count: counts.needs_review ?? 0,
      error_count: counts.error ?? 0,
    })
    .eq("id", batch.id)
    .eq("user_id", auth.user.id)
    .select("*")
    .single();
  if (updateError || !updatedBatch) return { success: false, error: "บันทึกตัวอย่างไม่สำเร็จ / Unable to save preview" };

  return { success: true, batch: updatedBatch, rows: updates.map((row) => previewRow(row as TransactionImportRow)) };
}

export async function setImportDuplicateIncluded(rowId: string, include: boolean): Promise<ImportActionResult> {
  if (!UUID_RE.test(rowId)) return { success: false, error: "Invalid row" };
  const auth = await authorizeImport();
  if ("error" in auth) return { success: false, error: auth.error ?? "Unauthorized" };
  const { data: row } = await auth.supabase
    .from("transaction_import_rows")
    .select("id, batch_id, normalized_data, status")
    .eq("id", rowId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!row?.normalized_data || !["duplicate", "ready", "needs_review"].includes(row.status)) return { success: false, error: "Row unavailable" };
  const { data: batch } = await auth.supabase.from("transaction_import_batches").select("status").eq("id", row.batch_id).eq("user_id", auth.user.id).maybeSingle();
  if (!batch || batch.status !== "ready") return { success: false, error: "Import is no longer editable" };
  const normalized = row.normalized_data as NormalizedImportRow;
  const nextStatus = include ? (normalized.reviewRequired ? "needs_review" : "ready") : "duplicate";
  const { error } = await auth.supabase.from("transaction_import_rows").update({ status: nextStatus }).eq("id", row.id).eq("user_id", auth.user.id);
  return error ? { success: false, error: friendlyDbError(error, "statementImport.duplicateOverride", "แก้ไขรายการไม่สำเร็จ") } : { success: true };
}

function revalidateImportViews() {
  for (const path of ["/money/import", "/money/transactions", "/money/accounts", "/dashboard"]) revalidatePath(path);
}

export async function confirmStatementImport(batchId: string): Promise<ImportActionResult<{
  importedCount: number;
  skippedCount: number;
  reviewCount: number;
  errorCount: number;
}>> {
  const parsed = statementImportBatchIdSchema.safeParse(batchId);
  if (!parsed.success) return { success: false, error: "Invalid import batch" };
  const auth = await authorizeImport();
  if ("error" in auth) return { success: false, error: auth.error ?? "Unauthorized" };
  const { data, error } = await auth.supabase.rpc("confirm_statement_import", { p_batch_id: parsed.data });
  if (error) return { success: false, error: friendlyDbError(error, "statementImport.confirm", "ยืนยันการนำเข้าไม่สำเร็จ") };
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) return { success: false, error: "Import result unavailable" };
  revalidateImportViews();
  return {
    success: true,
    importedCount: result.imported_count,
    skippedCount: result.skipped_count,
    reviewCount: result.review_count,
    errorCount: result.error_count,
  };
}

export async function rollbackStatementImport(batchId: string): Promise<ImportActionResult<{ deletedCount: number }>> {
  const parsed = statementImportBatchIdSchema.safeParse(batchId);
  if (!parsed.success) return { success: false, error: "Invalid import batch" };
  const auth = await authorizeImport();
  if ("error" in auth) return { success: false, error: auth.error ?? "Unauthorized" };
  const { data, error } = await auth.supabase.rpc("rollback_statement_import", { p_batch_id: parsed.data });
  if (error) return { success: false, error: friendlyDbError(error, "statementImport.rollback", "ยกเลิกการนำเข้าไม่สำเร็จ") };
  revalidateImportViews();
  return { success: true, deletedCount: Number(data ?? 0) };
}

export async function getStatementImportPreview(batchId: string): Promise<ImportPreview | null> {
  const parsed = statementImportBatchIdSchema.safeParse(batchId);
  if (!parsed.success) return null;
  const auth = await authorizeImport();
  if ("error" in auth) return null;
  const [{ data: batch }, { data: rows }] = await Promise.all([
    auth.supabase.from("transaction_import_batches").select("*").eq("id", parsed.data).eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("transaction_import_rows").select("*").eq("batch_id", parsed.data).eq("user_id", auth.user.id).order("row_number"),
  ]);
  if (!batch || !rows) return null;
  return { batch, rows: rows.map((row: TransactionImportRow) => previewRow(row)) };
}
