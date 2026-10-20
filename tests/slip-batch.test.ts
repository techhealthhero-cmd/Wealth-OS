import { describe, expect, it, vi } from "vitest";
import { classifySlipBatch, type BatchSlipInput } from "@/lib/slip/batch";
import { buildSlipSaveInput, processSlipBatch, saveReadySlips } from "@/features/capture/lib/slip-batch-import";
import { captureSaveSchema } from "@/lib/validation/capture";
import { BankCode } from "@/lib/slip/banks";
const text = (ref = "REF-A", time = "12:30:00") => `Amount: 100.00 THB\nDate: 20/10/2026 ${time}\nSender: Alice\nAccount 1234567890\nReceiver: Bob\nAccount 0987654321\nReference: ${ref}`;
const input = (ref = "REF-A", extra: Partial<BatchSlipInput> = {}): BatchSlipInput => ({ ocrText: text(ref), perspective: "sender", ocrConfidence: 95, ...extra });
const selection = { accountId: "00000000-0000-4000-8000-000000000001", categoryId: null };
describe("batch classification", () => {
  it("allows same amount and time with different explicit refs", () => {
    const result = classifySlipBatch([input(), input("REF-B")]);
    expect(result.ready).toHaveLength(2);
    expect(result.ready[0].clientRequestId).not.toBe(result.ready[1].clientRequestId);
  });
  it("detects repeated refs even with conflicting OCR and distinguishes income/expense", () => {
    const result = classifySlipBatch([input(), input("ref-a", { perspective: "receiver", ocrText: text("ref-a").replace("100.00", "200.00") })]);
    expect(result.duplicate[0].duplicateOf).toBe("batch:0");
    expect(result.items.map(item => item.direction)).toEqual(["expense", "income"]);
  });
  it("uses existing DB matcher, but distinct explicit references override time hint", () => {
    const candidates = [{ id: "db", amount: "100.00", type: "expense", transaction_date: "2026-10-20T12:30:00+07:00", reference: "REF-A" }];
    expect(classifySlipBatch([input()], candidates).duplicate[0].duplicateOf).toBe("db");
    expect(classifySlipBatch([input("REF-B")], candidates).ready).toHaveLength(1);
    expect(classifySlipBatch([input("", { ocrText: text("") })], candidates).duplicate).toHaveLength(1);
  });
  it("date-only DB row is not enough to mark an unreferenced payment duplicate", () => {
    expect(classifySlipBatch([input()], [{ id: "db", amount: "100.00", type: "expense", transaction_date: "2026-10-20" }]).ready).toHaveLength(1);
  });
  it("matches same-time no-ref entries only with same direction", () => {
    const result = classifySlipBatch([input(""), input("", { perspective: "receiver" }), input("")]);
    expect(result.ready).toHaveLength(2);
    expect(result.duplicate).toHaveLength(1);
  });
  it("holds identical no-ref date-only slips for review instead of silently sharing a save key", () => {
    const one = input("", { ocrText: text("").replace("12:30:00", "") });
    const result = classifySlipBatch([one, one]);
    expect(result.ready).toHaveLength(1); expect(result.unsure[0].reason).toContain("คนละรายการ");
  });
  it("merges QR reference and missing sender bank without overwriting OCR bank", () => {
    const qr = { sendingBankCode: "014", bankId: BankCode.SCB, transRef: "QR-REF" };
    const result = classifySlipBatch([input("OCR", { qr })]).items[0];
    expect(result.slip.reference).toBe("QR-REF"); expect(result.slip.sender.bank).toBe(BankCode.SCB);
    const known = classifySlipBatch([input("OCR", { qr, ocrText: text().replace("Sender: Alice", "Sender: Alice\nKBank") })]).items[0];
    expect(known.slip.sender.bank).toBe(BankCode.KBANK);
  });
  it.each([
    [{ ocrText: "Date: 20/10/2026" }, "จำนวนเงิน"],
    [{ ocrText: "Amount: 100.00 THB" }, "วันที่"],
    [{ perspective: undefined }, "เงินเข้าหรือเงินออก"],
    [{ ocrConfidence: 79 }, "ความมั่นใจ"],
    [{ ocrConfidence: NaN }, "ความมั่นใจ"],
    [{ perspective: "own-transfer" }, "บัญชีตนเอง"],
    [{ readError: true }, "อ่านภาพไม่สำเร็จ"],
  ] satisfies [Partial<BatchSlipInput>, string][]) ("routes incomplete/low-confidence slips for review: %j", (extra, reason) => {
    const item = classifySlipBatch([input("REF-A", extra)]).unsure[0];
    expect(item.reason).toContain(reason); expect(buildSlipSaveInput(item, selection)).toBeNull();
  });
  it("dedupes QR-only failures", () => {
    const qr = { sendingBankCode: "014", transRef: "QR-ONLY" };
    expect(classifySlipBatch([{ qr }, { qr }]).duplicate).toHaveLength(1);
  });
  it("generates stable UUIDs from normalized ref or fields", () => {
    const first = classifySlipBatch([input("ref-a")]).items[0];
    const retry = classifySlipBatch([input("REF-A")]).items[0];
    expect(first.clientRequestId).toBe(retry.clientRequestId);
    const noRef = classifySlipBatch([input("")]).items[0];
    expect(noRef.clientRequestId).toBe(classifySlipBatch([input("")]).items[0].clientRequestId);
    expect(noRef.clientRequestId).not.toBe(first.clientRequestId);
    expect(captureSaveSchema.safeParse(buildSlipSaveInput(first, selection)).success).toBe(true);
  });
  it("preserves partial saves and uses the same idempotency key on retry", async () => {
    const result = classifySlipBatch([input(), input("REF-B")]);
    const save = vi.fn().mockResolvedValueOnce({ id: "ok" }).mockRejectedValueOnce(Error("network"));
    const outcomes = await saveReadySlips(result.items, () => selection, save);
    expect(outcomes[0]).toEqual({ index: 0, result: { id: "ok" } });
    expect(outcomes[1]).toHaveProperty("error");
    const retry = vi.fn().mockResolvedValue({ id: "retry" });
    await saveReadySlips([result.items[1]], () => selection, retry);
    expect(retry.mock.calls[0][0].clientRequestId).toBe(save.mock.calls[1][0].clientRequestId);
  });
  it("maps income and expense to unchanged receipt save input", async () => {
    const result = classifySlipBatch([input(), input("REF-B", { perspective: "receiver" })]);
    expect(buildSlipSaveInput(result.ready[0], selection)).toMatchObject({ source: "receipt", reference: "REF-A", amountCents: 10000, type: "expense", merchant: "Bob" });
    expect(buildSlipSaveInput(result.ready[1], selection)).toMatchObject({ type: "income", merchant: "Alice" });
    const save = vi.fn().mockResolvedValue({ id: "saved" });
    await saveReadySlips([...result.items, classifySlipBatch([{}]).items[0]], () => selection, save);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
describe("orchestrator", () => {
  it("processes sequentially, reports progress, discards images/text from results", async () => {
    const events: string[] = [];
    const files = [new Blob(["one"]), new Blob(["two"])];
    const result = await processSlipBatch(files, {
      perspective: "sender",
      qrDecode: async image => { events.push(`qr:${await image.text()}`); return null; },
      ocr: async image => { events.push(`ocr:${await image.text()}`); return { text: text(await image.text()), confidence: 95 }; },
      fetchCandidates: async slips => { expect(slips).toHaveLength(2); events.push("fetch"); return []; },
      onProgress: p => events.push(`${p.phase}:${p.completed}`),
    });
    expect(events).toEqual(["reading:0", "qr:one", "ocr:one", "reading:1", "qr:two", "ocr:two", "reading:2", "matching:2", "fetch", "done:2"]);
    expect(result.ready).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("ocrText");
    expect(result.items[0]).not.toHaveProperty("image");
  });
  it("continues after local failures and keeps QR duplicate evidence", async () => {
    const result = await processSlipBatch([new Blob(), new Blob()], {
      ocr: async () => { throw Error("bad image"); }, qrDecode: async () => null,
      fetchCandidates: async () => [],
    });
    expect(result.unsure).toHaveLength(2);
    expect(result.unsure[0].reason).toContain("อ่านภาพไม่สำเร็จ");
  });
  it("does not hide candidate fetch failures", async () => {
    await expect(processSlipBatch([], { ocr: vi.fn(), qrDecode: vi.fn(), fetchCandidates: async () => { throw Error("offline"); } })).rejects.toThrow("offline");
  });
  it("stops on abort before another OCR or candidate query", async () => {
    const controller = new AbortController();
    const ocr = vi.fn(async () => { controller.abort(); return { text: text(), confidence: 95 }; });
    const fetchCandidates = vi.fn();
    await expect(processSlipBatch([new Blob(), new Blob()], { ocr, qrDecode: async () => null, fetchCandidates, signal: controller.signal })).rejects.toThrow();
    expect(ocr).toHaveBeenCalledTimes(1); expect(fetchCandidates).not.toHaveBeenCalled();
  });
});
