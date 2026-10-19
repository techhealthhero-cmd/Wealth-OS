"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n/dictionaries";
import { captureSaveSchema, type CaptureSaveInput } from "@/lib/validation/capture";
import { buildAssetSchema } from "@/lib/validation/asset";
import { buildLiabilitySchema } from "@/lib/validation/liability";
import { ASSET_GROUPS } from "@/lib/financial/asset-taxonomy";
import { buildPaymentPlan, smartCaptureHasPlan, type SmartCaptureIntent, type RatePeriod } from "@/lib/capture/purchase-intent";
import { centsToDecimalString, parseMoneyToCents } from "@/lib/financial/money";
import { deterministicUuid } from "@/lib/uuid";
import { insertRecurringTransaction } from "@/features/recurring/insert";
import { saveCapturedTransaction, type CaptureSaveResult } from "./actions";

const money = z.number().int().nonnegative().lt(1e15);
const schema = z.object({
  capture: z.unknown(),
  smart: z.object({
    kind: z.enum(["asset_cash", "asset_installment", "loan"]),
    assetName: z.string().trim().min(1).max(80), group: z.string().max(50), subcategory: z.string().max(50),
    assetDecision: z.enum(["asset", "ask"]), priceCents: money.positive(), downPaymentCents: money,
    ratePct: z.number().finite().min(0).max(1200), ratePeriod: z.enum(["month", "year"]).nullable(),
    ratePeriodNeedsConfirm: z.boolean(), termMonths: z.number().int().min(1).max(1200), termAssumed: z.boolean(),
    statedMonthlyCents: money.positive().nullable(),
    liabilityType: z.enum(["mortgage", "car_loan", "personal_loan", "informal_debt", "student_loan"]),
  }),
  assetAccepted: z.boolean().optional(), ratePeriod: z.enum(["month", "year"]).optional(),
});
export interface SmartCaptureSaveInput { capture: CaptureSaveInput; smart: SmartCaptureIntent; assetAccepted?: boolean; ratePeriod?: RatePeriod }
export interface SmartCaptureSaveResult extends CaptureSaveResult {
  assetError?: string; liabilityError?: string; assetCreated?: boolean; liabilityCreated?: boolean;
  /** The money movement is saved but an asset/liability/schedule part is missing: keep the draft and
   * its clientRequestId so a retry fills only the missing parts (markers + deterministic ids). */
  incomplete?: boolean;
}

/** Session auth only; all numbers rebuilt from validated inputs, never client plan totals.
 * Deterministic PKs close the concurrent-retry race; notes markers allow recovery/auditing
 * without a new column. Each ancillary failure is independent of an already posted payment.
 */
export async function saveSmartCapture(input: SmartCaptureSaveInput): Promise<SmartCaptureSaveResult> {
  const dict = getDictionary(await getLocale());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: dict.common.invalidInput };
  const d = parsed.data;
  const s = d.smart;
  let group = ASSET_GROUPS.find((g) => g.key === s.group);
  if (!group || (s.kind !== "loan" && !group.subcategories.some((p) => p.key === s.subcategory))) return { error: dict.common.invalidInput };
  if (s.downPaymentCents > s.priceCents) return { error: dict.common.invalidInput };
  if (s.kind === "asset_cash" && s.assetDecision === "ask" && d.assetAccepted === undefined) return { error: dict.common.invalidInput };
  let period = d.ratePeriod ?? s.ratePeriod;
  if (s.kind !== "asset_cash" && (!period || (s.ratePeriodNeedsConfirm && !d.ratePeriod))) return { error: dict.common.invalidInput };
  let movement = s.kind === "asset_installment" ? s.downPaymentCents : s.priceCents;
  // Zero-down plans still validate every normal capture field, but post no transaction.
  const capture = captureSaveSchema.safeParse({ ...(d.capture as object), type: s.kind === "loan" ? "income" : "expense", amountCents: movement || 1, recurring: undefined });
  if (!capture.success) return { error: dict.common.invalidInput };
  const c = capture.data;
  const captureDate = new Date(`${c.date}T00:00:00Z`);
  if (!Number.isFinite(+captureDate) || captureDate.toISOString().slice(0, 10) !== c.date) return { error: dict.common.invalidInput };
  const marker = `[capture:${c.clientRequestId}]`;
  // Recover an immutable plan from a previously completed part. This also keeps
  // zero-down retries on the original date/account and repairs failed later parts
  // using the original terms, even if the preview changed while retrying.
  const tables = s.kind === "loan" ? ["liabilities" as const] : s.kind === "asset_cash" ? ["assets" as const] : ["assets" as const, "liabilities" as const];
  for (const table of tables) {
    const { data: previous, error: readError } = await supabase.from(table).select("name,notes")
      .eq("user_id", user.id).eq("id", deterministicUuid(`smart-capture:${user.id}:${c.clientRequestId}:${table}`)).maybeSingle();
    if (readError) continue; // Ancillary lookup failure must not block the payment.
    if (!previous?.notes?.startsWith(`${marker} `)) continue;
    try {
      const saved = JSON.parse(previous.notes.slice(marker.length + 1));
      const recovered = schema.shape.smart.safeParse({ ...s, assetName: previous.name,
        priceCents: saved.priceCents, downPaymentCents: saved.downPaymentCents, ratePct: saved.ratePct,
        ratePeriod: saved.period, ratePeriodNeedsConfirm: false, termMonths: saved.termMonths ?? s.termMonths,
        termAssumed: false, statedMonthlyCents: saved.statedMonthlyCents ?? null, group: saved.group, subcategory: saved.subcategory,
      });
      const context = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), accountId: z.string().uuid(), categoryId: z.string().uuid().nullable() }).safeParse({ date: saved.captureDate, accountId: saved.accountId, categoryId: saved.categoryId });
      if (recovered.success && context.success) {
        Object.assign(s, recovered.data); Object.assign(c, context.data);
        group = ASSET_GROUPS.find((g) => g.key === s.group)!;
        if (!group) return { error: dict.common.invalidInput };
        period = s.ratePeriod;
        break;
      }
    } catch { /* A user-edited note is not trusted as capture metadata. */ }
  }
  // Existing transaction idempotency returns the first payment. Use its actual
  // movement for recovery when every ancillary insert previously failed.
  const { data: previousPayment } = await supabase.from("transactions")
    .select("amount,transaction_date,account_id,category_id,type").eq("user_id", user.id).eq("client_request_id", c.clientRequestId).maybeSingle();
  // The existing save action remains authoritative if this recovery lookup fails.
  if (previousPayment) {
    if (previousPayment.type !== c.type) return { error: dict.common.invalidInput };
    const paid = parseMoneyToCents(previousPayment.amount);
    if (s.kind === "asset_installment") s.downPaymentCents = paid;
    else s.priceCents = paid;
    c.date = previousPayment.transaction_date; c.accountId = previousPayment.account_id;
    c.categoryId = previousPayment.category_id;
  }
  movement = s.kind === "asset_installment" ? s.downPaymentCents : s.priceCents;
  const principal = s.kind === "loan" ? s.priceCents : s.priceCents - s.downPaymentCents;
  let plan;
  try {
    plan = !smartCaptureHasPlan(s.kind, s.ratePct, s.termAssumed, period ?? null) ? null : buildPaymentPlan({ principalCents: principal, ratePct: s.ratePct, ratePeriod: period!, termMonths: s.termAssumed ? period === "month" && s.ratePct > 0 ? 6 : 12 : s.termMonths, captureDate: c.date, statedMonthlyCents: s.statedMonthlyCents, fixedTerm: !s.termAssumed });
  } catch { return { error: dict.common.invalidInput }; }
  // Explicit ownership check also covers zero-down plans without a transaction/RLS insert.
  const { data: account, error: accountError } = await supabase.from("accounts").select("id").eq("id", c.accountId).eq("user_id", user.id).eq("is_archived", false).maybeSingle();
  if (accountError || !account) return { error: dict.common.invalidInput };
  if (s.kind === "loan") {
    const { data: categories } = await supabase.from("categories").select("id,name_th,name_en,type").in("type", ["income", "both"]);
    const match = categories?.find((row) => /เงินกู้|loan/i.test(`${row.name_th} ${row.name_en}`));
    const fallback = categories?.find((row) => row.id === c.categoryId) ?? categories?.find((row) => /อื่น|other/i.test(`${row.name_th} ${row.name_en}`));
    c.categoryId = match?.id ?? fallback?.id ?? null;
  }
  const result: SmartCaptureSaveResult = movement > 0 ? await saveCapturedTransaction({ ...c, amountCents: movement }) : { success: true };
  if (!result.success) return result;
  if (s.kind === "asset_cash" && d.assetAccepted === false) return result;
  const notes = `${marker} ${JSON.stringify({ captureDate: c.date, accountId: c.accountId, categoryId: c.categoryId, statedMonthlyCents: s.statedMonthlyCents, priceCents: s.priceCents, downPaymentCents: s.downPaymentCents, ratePct: s.ratePct, period, termMonths: plan?.termMonths, monthlyCents: plan?.monthlyPaymentCents, totalInterestCents: plan?.totalInterestCents, totalPaidCents: plan?.totalPaidCents, firstDueDate: plan?.firstDueDate, lastDueDate: plan?.lastDueDate, finalPaymentCents: plan?.schedule.at(-1)?.paymentCents, group: s.group, subcategory: s.subcategory })}`;
  async function insertPart(table: "assets" | "liabilities", row: Record<string, unknown>): Promise<{ created: boolean; error?: string }> {
    try {
      const { data: existing, error: lookupError } = await supabase.from(table).select("id").eq("user_id", user!.id).like("notes", `%${marker}%`).limit(1);
      if (lookupError) return { created: false, error: dict.capture.smart.partialFailed };
      if (existing?.length) return { created: false };
      const { error } = await supabase.from(table).insert({ ...row, user_id: user!.id, id: deterministicUuid(`smart-capture:${user!.id}:${c.clientRequestId}:${table}`) });
      return error && error.code !== "23505" ? { created: false, error: dict.capture.smart.partialFailed } : { created: !error };
    } catch { return { created: false, error: dict.capture.smart.partialFailed }; }
  }
  if (s.kind !== "loan") {
    const asset = buildAssetSchema(dict).safeParse({ name: s.assetName, asset_type: group.assetType, value: centsToDecimalString(s.priceCents), include_in_net_worth: true, notes });
    const part = asset.success ? await insertPart("assets", asset.data) : { created: false, error: dict.common.invalidInput };
    result.assetCreated = part.created; result.assetError = part.error;
  }
  if (plan || s.kind === "loan") {
    // Calendar/upcoming dedupe requires identical label+date+amount. Liability name
    // differs from "ผ่อน…" merchant, and its one-off due date becomes stale: the
    // recurring schedule is the sole calendar source until liability_id is approved.
    const liability = buildLiabilitySchema(dict).safeParse({ name: s.assetName, liability_type: s.kind === "loan" ? s.liabilityType : group.assetType === "property" ? "mortgage" : group.assetType === "vehicle" ? "car_loan" : "personal_loan", balance: centsToDecimalString(principal), interest_rate: plan?.annualRatePct ?? s.ratePct * (period === "month" ? 12 : 1), minimum_payment: plan ? centsToDecimalString(plan.monthlyPaymentCents) : null, due_date: null, include_in_net_worth: true, notes });
    const part = liability.success ? await insertPart("liabilities", liability.data) : { created: false, error: dict.common.invalidInput };
    result.liabilityCreated = part.created; result.liabilityError = part.error;
    if (plan && plan.monthlyPaymentCents > 0) {
      // A recurring template posts one fixed amount. When the final installment differs by more
      // than ฿1 (balloon / stated payment), the regular schedule stops one month early and the
      // final installment gets its own one-occurrence schedule (start = end) with its exact amount.
      const finalCents = plan.schedule.at(-1)!.paymentCents;
      const splitFinal = plan.schedule.length > 1 && Math.abs(finalCents - plan.monthlyPaymentCents) > 100;
      const parts = [
        { key: "recurring", amount: plan.monthlyPaymentCents, start: plan.firstDueDate, end: splitFinal ? plan.schedule.at(-2)!.dueDate : plan.lastDueDate, label: `ผ่อน${s.assetName}` },
        ...(splitFinal ? [{ key: "recurring-final", amount: finalCents, start: plan.lastDueDate, end: plan.lastDueDate, label: `ผ่อน${s.assetName} (งวดสุดท้าย)` }] : []),
      ];
      result.recurringCreated = true;
      for (const part of parts) {
        try {
          const recurring = await insertRecurringTransaction(supabase, user.id, {
            type: "expense", amount: centsToDecimalString(part.amount), account_id: c.accountId,
            category_id: s.kind === "loan" ? null : c.categoryId, merchant: part.label.slice(0, 120),
            description: `${marker} ${dict.capture.smart.finalPayment}: ${centsToDecimalString(finalCents)}`,
            frequency: "monthly", start_date: part.start, end_date: part.end, is_active: true,
          }, dict, { idempotencyId: deterministicUuid(`smart-capture:${user.id}:${c.clientRequestId}:${part.key}`) });
          result.recurringCreated = result.recurringCreated && (recurring.created || !!recurring.alreadyExists);
          if (recurring.error) result.recurringError = recurring.error;
        } catch { result.recurringError = dict.capture.smart.partialFailed; result.recurringCreated = false; }
      }
    }
  }
  result.incomplete = !!(result.assetError || result.liabilityError || result.recurringError);
  for (const path of ["/money/assets", "/money/liabilities", "/money/net-worth", "/money/recurring", "/dashboard"]) revalidatePath(path);
  return result;
}
