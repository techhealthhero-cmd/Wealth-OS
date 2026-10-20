import { parseSlipText } from "./parse";
import { matchSlipToTransactions } from "./match";
import { parseSlipQR, type SlipQR } from "./qr";
import type { ParsedSlip, SlipTransaction } from "./types";

export interface BatchSlipInput {
  ocrText?: string;
  /** OCR engine confidence, 0–100; omitted for manually supplied text. */
  ocrConfidence?: number;
  qr?: string | SlipQR | null;
  /** Explicit account perspective, supplied by review/account selection; never guessed from names. */
  perspective?: "sender" | "receiver" | "own-transfer";
  readError?: boolean;
}
export interface BatchSlip {
  index: number;
  slip: ParsedSlip;
  direction: "expense" | "income" | "transfer" | null;
  clientRequestId: string;
  status: "ready" | "duplicate" | "unsure";
  reason: string;
  duplicateOf?: string;
}
export interface SlipBatchResult { items: BatchSlip[]; ready: BatchSlip[]; duplicate: BatchSlip[]; unsure: BatchSlip[] }
function normalize(value: string): string { return value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase(); }
/** Deterministic UUID-shaped 128-bit hash. Idempotency only, not cryptographic identity. */
function requestId(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const words = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35].map(seed => {
    let hash = seed;
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
    return hash.toString(16).padStart(8, "0");
  }).join("").split("");
  words[12] = "5"; words[16] = ((parseInt(words[16], 16) & 3) | 8).toString(16);
  const hex = words.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function classifySlipBatch(inputs: readonly BatchSlipInput[], candidates: readonly SlipTransaction[] = []): SlipBatchResult {
  const earlier: SlipTransaction[] = [];
  const identities = new Set<string>();
  const items = inputs.map((input, index): BatchSlip => {
    const slip = parseSlipText(input.ocrText ?? "");
    const qr = typeof input.qr === "string" ? parseSlipQR(input.qr) : input.qr;
    if (qr) {
      slip.reference = qr.transRef;
      slip.confidence.reference = 1;
      if (!slip.sender.bank && qr.bankId) { slip.sender.bank = qr.bankId; slip.confidence.senderBank = 1; }
    }
    const direction = input.perspective === "sender" ? "expense" : input.perspective === "receiver" ? "income" : input.perspective === "own-transfer" ? "transfer" : null;
    // Ref is the strongest identity. Without it, use all normalized extracted fields,
    // including direction, parties and time (never amount alone).
    const identity = slip.reference ? `ref:${normalize(slip.reference)}` : `fields:${normalize(JSON.stringify([slip.amount, slip.dateTime ?? slip.date, direction, slip.sender, slip.receiver]))}`;
    const item: BatchSlip = { index, slip, direction, clientRequestId: requestId(identity), status: "ready", reason: "พร้อมบันทึก" };
    const perspective = input.perspective === "receiver" ? "receiver" : "sender";
    const duplicate = matchSlipToTransactions(slip, [...candidates, ...earlier], { perspective }).find(match => {
      if (!match.likelyDuplicate) return false;
      // Distinct explicit references are distinct payments, even at the same second.
      if (slip.reference && match.transaction.reference && normalize(slip.reference) !== normalize(match.transaction.reference)) return false;
      // Time-only evidence is insufficient when direction is unknown or a transfer.
      return match.reasons.includes("duplicate_reference") || direction === "expense" || direction === "income";
    });
    if (duplicate) {
      item.status = "duplicate"; item.reason = "พบรายการซ้ำ กรุณาตรวจสอบ"; item.duplicateOf = duplicate.transaction.id;
    } else {
      const reasons: string[] = [];
      if (!slip.reference && identities.has(identity)) reasons.push("ข้อมูลเหมือนสลิปก่อนหน้า กรุณายืนยันว่าเป็นคนละรายการ");
      if (input.readError) reasons.push("อ่านภาพไม่สำเร็จ");
      if (slip.amount === null || slip.amount <= 0 || slip.amount >= 10 ** 15) reasons.push("ไม่พบจำนวนเงินที่ใช้ได้");
      if (!slip.date) reasons.push("ไม่พบวันที่");
      if (!direction) reasons.push("ยังไม่ทราบว่าเป็นเงินเข้าหรือเงินออก");
      if (direction === "transfer") reasons.push("โอนระหว่างบัญชีตนเอง กรุณาใช้รายการโอน");
      if (input.ocrConfidence !== undefined && (!Number.isFinite(input.ocrConfidence) || input.ocrConfidence < 80 || input.ocrConfidence > 100)) reasons.push("ความมั่นใจในการอ่านต่ำ");
      if ((slip.amount !== null && slip.confidence.amount < 0.8) || (slip.date && slip.confidence.date < 0.8)) reasons.push("ข้อมูลยังไม่ชัดเจน");
      if ((slip.reference?.length ?? 0) > 80) reasons.push("เลขอ้างอิงยาวเกินกำหนด");
      if (reasons.length) { item.status = "unsure"; item.reason = reasons.join(" · "); }
    }
    identities.add(identity);
    if (slip.amount !== null && slip.date) earlier.push({
      id: `batch:${index}`, amount: `${Math.floor(slip.amount / 100)}.${String(slip.amount % 100).padStart(2, "0")}`,
      type: direction ?? "unknown", transaction_date: slip.dateTime ?? slip.date,
      reference: slip.reference,
    });
    // QR-only failures must also participate in reference deduplication.
    else if (slip.reference) earlier.push({ id: `batch:${index}`, amount: "0", type: direction ?? "unknown", transaction_date: slip.date ?? "", reference: slip.reference });
    return item;
  });
  return { items, ready: items.filter(item => item.status === "ready"), duplicate: items.filter(item => item.status === "duplicate"), unsure: items.filter(item => item.status === "unsure") };
}
