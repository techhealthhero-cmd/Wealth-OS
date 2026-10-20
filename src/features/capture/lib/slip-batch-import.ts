import { classifySlipBatch, type BatchSlip, type BatchSlipInput, type SlipBatchResult } from "@/lib/slip/batch";
import type { SlipTransaction } from "@/lib/slip/types";
import type { CaptureSaveInput } from "@/lib/validation/capture";
import type { SlipOCRResult } from "./local-slip-ocr";

export interface SlipBatchDeps {
  ocr(image: Blob): Promise<SlipOCRResult>;
  qrDecode(image: Blob): Promise<string | null>;
  /** Receives extracted fields only, never images or full OCR text. Failure aborts before any save. */
  fetchCandidates(slips: readonly BatchSlip["slip"][]): Promise<readonly SlipTransaction[]>;
  perspective?: BatchSlipInput["perspective"] | ((index: number) => BatchSlipInput["perspective"]);
  onProgress?(progress: { completed: number; total: number; phase: "reading" | "matching" | "done" }): void;
  signal?: AbortSignal;
}
/** Sequential, dependency-injected processing; no images in results, no persistence or implicit save. */
export async function processSlipBatch(files: readonly Blob[], deps: SlipBatchDeps): Promise<SlipBatchResult> {
  const inputs: BatchSlipInput[] = [];
  deps.signal?.throwIfAborted();
  deps.onProgress?.({ completed: 0, total: files.length, phase: "reading" });
  for (let index = 0; index < files.length; index++) {
    deps.signal?.throwIfAborted();
    const input: BatchSlipInput = { perspective: typeof deps.perspective === "function" ? deps.perspective(index) : deps.perspective };
    try { input.qr = await deps.qrDecode(files[index]); } catch { /* OCR can still succeed. */ }
    deps.signal?.throwIfAborted();
    try {
      const result = await deps.ocr(files[index]);
      input.ocrText = result.text; input.ocrConfidence = result.confidence;
    } catch { input.readError = true; }
    deps.signal?.throwIfAborted();
    inputs.push(input);
    deps.onProgress?.({ completed: index + 1, total: files.length, phase: "reading" });
  }
  const preliminary = classifySlipBatch(inputs);
  deps.onProgress?.({ completed: files.length, total: files.length, phase: "matching" });
  const candidates = await deps.fetchCandidates(preliminary.items.map(item => item.slip));
  deps.signal?.throwIfAborted();
  const result = classifySlipBatch(inputs, candidates);
  deps.onProgress?.({ completed: files.length, total: files.length, phase: "done" });
  return result;
}
export interface SlipSaveSelection { accountId: string; categoryId: string | null; categoryConfirmedByUser?: boolean }
/** Pass this payload to the existing saveCapturedTransaction from the UI layer. */
export function buildSlipSaveInput(item: BatchSlip, selection: SlipSaveSelection): CaptureSaveInput | null {
  if (item.status !== "ready" || !item.slip.amount || !item.slip.date || (item.direction !== "expense" && item.direction !== "income")) return null;
  const counterparty = item.direction === "expense" ? item.slip.receiver : item.slip.sender;
  return {
    clientRequestId: item.clientRequestId, type: item.direction, amountCents: item.slip.amount,
    ...selection, merchant: counterparty.name?.slice(0, 120) ?? null, description: null,
    date: item.slip.date, source: "receipt", reference: item.slip.reference,
    // OCR confidence does not establish a category. Keep in the inbox until confirmed.
    confidence: "medium",
  };
}
/** Inject the existing action; callers retain successes/errors for selective retries. */
export type SlipSaveOutcome<T> = { index: number; result: T } | { index: number; error: unknown };
export async function saveReadySlips<T>(items: readonly BatchSlip[], select: (item: BatchSlip) => SlipSaveSelection, save: (input: CaptureSaveInput) => Promise<T>): Promise<SlipSaveOutcome<T>[]> {
  const results: SlipSaveOutcome<T>[] = [];
  for (const item of items) {
    if (item.status !== "ready") continue;
    const input = buildSlipSaveInput(item, select(item));
    if (input) {
      try { results.push({ index: item.index, result: await save(input) }); }
      catch (error) { results.push({ index: item.index, error }); }
    }
  }
  return results;
}
