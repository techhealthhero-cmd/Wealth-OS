import { z } from "zod";

/**
 * Payload for saving one Quick Capture result. Amount travels as integer
 * satang (the parser's native unit) — never a float — and is converted to
 * a NUMERIC-safe decimal string only at the insert.
 */
export const captureSaveSchema = z.object({
  clientRequestId: z.string().uuid(),
  type: z.enum(["expense", "income"]),
  amountCents: z.number().int().positive().lt(10 ** 15),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  merchant: z.string().trim().max(120).nullable(),
  description: z.string().trim().max(200).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["quick_text", "voice", "receipt"]),
  confidence: z.enum(["high", "medium", "low"]),
  reference: z.string().trim().max(80).nullable().optional(),
  /** true when the user explicitly picked/changed the category in the preview. */
  categoryConfirmedByUser: z.boolean().default(false),
});

export type CaptureSaveInput = z.input<typeof captureSaveSchema>;

export const duplicateCheckSchema = z.object({
  amountCents: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().trim().max(120).nullable(),
  reference: z.string().trim().max(80).nullable().optional(),
});

export type DuplicateCheckInput = z.input<typeof duplicateCheckSchema>;

/** Strict shape the receipt/slip model must return (validated, never trusted). */
export const receiptModelOutputSchema = z.object({
  is_payment_document: z.boolean().optional().default(true),
  amount: z.union([z.number(), z.string()]).nullable().optional(),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional().default("low"),
});
