import "server-only";

import { getAIProvider, type AIProvider } from "@/features/ai/lib/provider";
import type { AIImageMediaType } from "@/features/ai/types";
import { EMPTY_EXTRACTION, normalizeReceiptModelOutput, type ReceiptExtraction } from "@/lib/capture/receipt-normalize";

export interface ReceiptImage {
  mediaType: AIImageMediaType;
  base64Data: string;
}

export interface ReceiptParseResult {
  extraction: ReceiptExtraction;
  /** Present when a real model ran — for AI usage metering. */
  usage?: { model: string; inputTokens: number; outputTokens: number };
  mock?: boolean;
}

/**
 * Receipt/slip parsing abstraction. The capture action only ever talks to
 * this interface, so swapping the model, adding a dedicated OCR service, or
 * a bank-import path later means one new implementation here — no UI or
 * action changes.
 */
export interface ReceiptParser {
  parse(image: ReceiptImage, today: string): Promise<ReceiptParseResult>;
}

const SYSTEM_PROMPT = `You read photos of Thai payment slips (bank/e-wallet transfer confirmations, PromptPay) and shop receipts.
Return ONLY one JSON object, no prose, with exactly these keys:
{"is_payment_document": boolean, "amount": number|null, "date": "YYYY-MM-DD"|null, "time": "HH:MM"|null, "merchant": string|null, "payment_method": string|null, "reference": string|null, "note": string|null, "payer_account": string|null, "sender_name": string|null, "sender_bank": string|null, "receiver_bank": string|null, "receiver_account": string|null, "confidence": "high"|"medium"|"low"}
Rules:
- amount: the total actually paid in THB, as a plain number (no currency, no commas). For a receipt use the grand total, not a line item.
- date: as printed. Thai slips often use Buddhist-era years (e.g. 2569) — you may return them as printed; do not guess a date that is not shown.
- merchant: the store name, or the transfer RECIPIENT's name on a slip (not the sender). For a wallet top-up the recipient is the wallet biller, copied as printed (e.g. "พร้อมเพย์ อี-วอลเล็ต / G-Wallet", "TrueMoney Wallet", "ShopeePay", "LINE Pay", "Rabbit LINE Pay", "เป๋าตัง").
- sender_name: the payer's name as printed, including any title (นาย/นาง/นางสาว). null if not shown. Never the recipient.
- sender_bank: the payer's bank as printed (e.g. "ธ.กสิกรไทย", "ไทยพาณิชย์", "กรุงเทพ", "กรุงไทย", "ทีทีบี", "ออมสิน"). null if not shown.
- receiver_bank: the recipient's bank as printed. null on a shop receipt or when not shown.
- payment_method: the paying bank or app if shown (e.g. "KBank", "SCB", "Krungthai", "TrueMoney", "credit card", "cash").
- reference: the transaction reference / ref no. if shown, else null.
- note: the memo the payer typed, exactly as printed — on Thai slips the text after "บันทึกช่วยจำ:" (or "Memo:" / "Note:"). null if no memo is printed. Not the merchant, not a reference number. Keep memos like "เติมเป๋าตัง", "เติมเงิน", "โอนไปบัญชีหลัก" exactly.
- payer_account: the PAYING (sender) account number exactly as printed, masked digits included (e.g. "xxx-x-x7513-x", "xxx-x-xx123-4", "XXX-X-X1234-X", "xxxxxx1234"). Keep every x and every visible digit in its position. null if not shown. Never the recipient's.
- receiver_account: the RECIPIENT account number exactly as printed, same mask rules. null if not shown. Never the payer's.
- confidence: "high" only if amount and merchant are clearly legible. A wallet top-up or a transfer to the payer's own name is still "high" when the amount and the recipient are legible.
- If the image is not a receipt or payment slip, set is_payment_document to false and everything else null.
Never invent values that are not visible in the image.`;

export class AIReceiptParser implements ReceiptParser {
  constructor(private readonly provider: AIProvider) {}

  async parse(image: ReceiptImage, today: string): Promise<ReceiptParseResult> {
    const result = await this.provider.generate({
      system: SYSTEM_PROMPT,
      maxTokens: 600,
      thinking: "off",
      messages: [
        {
          role: "user",
          content: "Extract the payment details from this image as JSON.",
          images: [{ mediaType: image.mediaType, base64Data: image.base64Data }],
        },
      ],
    });
    return {
      extraction: normalizeReceiptModelOutput(result.content, today),
      usage: { model: result.model, ...result.usage },
    };
  }
}

/** The configured parser: the mock when CAPTURE_OCR_MOCK=1, the AI model when a key is set, else null (not enabled). */
export function getReceiptParser(): ReceiptParser | null {
  if (process.env.CAPTURE_OCR_MOCK === "1") return new MockReceiptParser();
  const provider = getAIProvider();
  return provider ? new AIReceiptParser(provider) : null;
}

/**
 * Dev/demo parser (env CAPTURE_OCR_MOCK=1). Returns an obviously-mock
 * result flagged `mock: true` — the UI labels it — so it can never be
 * mistaken for a real reading of the user's image.
 */
export class MockReceiptParser implements ReceiptParser {
  async parse(_image: ReceiptImage, today: string): Promise<ReceiptParseResult> {
    return {
      mock: true,
      extraction: {
        ...EMPTY_EXTRACTION,
        isPaymentDocument: true,
        amountCents: 24900,
        date: today,
        merchant: "KFC",
        paymentMethod: "KBank",
        reference: null,
        confidence: "medium",
      },
    };
  }
}
