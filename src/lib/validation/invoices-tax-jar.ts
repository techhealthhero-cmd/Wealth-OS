import { z } from "zod";
import { calculateInvoiceTotals } from "@/lib/financial/invoice";

export const calendarDateSchema = z.iso.date();
export const idSchema = z.uuid();
const optionalId = idSchema.nullish();
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
// Match numeric(12,2), so database rounding cannot change the computed totals.
const quantity = z.number().positive().max(9_999_999_999.99)
  .refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.0001);
export const invoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(40),
  clientName: z.string().trim().min(1).max(120),
  clientIsCompany: z.boolean().default(false),
  issueDate: calendarDateSchema,
  dueDate: calendarDateSchema,
  withholdingRatePct: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).default(0),
  items: z.array(z.object({ description: z.string().trim().min(1).max(200), quantity, unitPriceCents: cents })).min(1).max(50),
  receiveAccountId: optionalId,
  categoryId: optionalId,
  earnProjectId: optionalId,
  notes: z.string().trim().max(1000).nullish(),
}).refine(v => v.dueDate >= v.issueDate).refine(v => {
  try { calculateInvoiceTotals(v.items, { withholdingRatePct: v.withholdingRatePct }); return true; }
  catch { return false; }
});
export const markInvoicePaidSchema = z.object({
  invoiceId: idSchema, paidDate: calendarDateSchema, accountId: optionalId, allowDraft: z.boolean().default(false),
});
const rate = z.number().min(0).max(50).multipleOf(0.1);
export const taxYearSchema = z.number().int().min(2020).max(2100);
export const taxJarSettingsSchema = z.object({
  ratePct: rate.default(7), mode: z.enum(["ask", "auto"]).default("ask"), accountId: optionalId,
  expense408RatePct: z.number().min(0).max(100).multipleOf(0.1).default(60),
  extraDeductionsCents: cents.default(0),
});
export const taxJarEntrySchema = z.object({
  kind: z.enum(["set_aside", "withdraw", "adjust"]), amountCents: cents.refine(v => v > 0),
  taxYear: taxYearSchema, rate: rate.nullish(), sourceTransactionId: optionalId,
  incomeType: z.enum(["40_2", "40_8"]).nullish(), entryDate: calendarDateSchema,
  note: z.string().trim().max(200).nullish(),
});
export type InvoiceInput = z.input<typeof invoiceSchema>;
export type TaxJarSettingsInput = z.input<typeof taxJarSettingsSchema>;
export type TaxJarEntryInput = z.input<typeof taxJarEntrySchema>;
