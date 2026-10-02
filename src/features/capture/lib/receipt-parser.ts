import "server-only";

import type { AIProvider } from "@/features/ai/lib/provider";
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
{"is_payment_document": boolean, "amount": number|null, "date": "YYYY-MM-DD"|null, "time": "HH:MM"|null, "merchant": string|null, "payment_method": string|null, "reference": string|null, "confidence": "high"|"medium"|"low"}
Rules:
- amount: the total actually paid in THB, as a plain number (no currency, no commas). For a receipt use the grand total, not a line item.
- date: as printed. Thai slips often use Buddhist-era years (e.g. 2569) — you may return them as printed; do not guess a date that is not shown.
- merchant: the store name, or the transfer RECIPIENT's name on a slip (not the sender).
- payment_method: the paying bank or app if shown (e.g. "KBank", "SCB", "Krungthai", "TrueMoney", "credit card", "cash").
- reference: the transaction reference / ref no. if shown, else null.
- confidence: "high" only if amount and merchant are clearly legible.
- If the image is not a receipt or payment slip, set is_payment_document to false and everything else null.
Never invent values that are not visible in the image.`;

export class AIReceiptParser implements ReceiptParser {
  constructor(private readonly provider: AIProvider) {}

  async parse(image: ReceiptImage, today: string): Promise<ReceiptParseResult> {
    const result = await this.provider.generate({
      system: SYSTEM_PROMPT,
      maxTokens: 400,
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
