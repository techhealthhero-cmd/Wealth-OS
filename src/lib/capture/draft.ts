import { evaluateCaptureConfidence, type ConfidenceContext, type CaptureConfidenceResult } from "./confidence";
import type { ParsedCapture } from "./transaction-parser";
import { resolveSmartCapture, type SmartCaptureIntent, type RatePeriod } from "./purchase-intent";
import type { CaptureConfidence } from "@/types/database";
import type { SubscriptionIntent } from "./subscription-intent";
import type { CategorySource } from "./transaction-parser";
import type { CaptureSaveInput } from "@/lib/validation/capture";

/** What the Quick Capture preview card shows and lets the user adjust before saving. */
export interface CaptureDraft {
  isEmergencyFundDraw?: boolean;
  emergencyFundAccountMissing?: boolean;
  confidenceGate?: CaptureConfidenceResult;
  smart?: SmartCaptureIntent | null;
  smartAssetAccepted?: boolean;
  smartRatePeriod?: RatePeriod;
  subscription?: SubscriptionIntent | null;
  subscriptionAccountMissing?: boolean;
  cancelIntent?: { serviceQuery: string } | null;
  addRecurring?: boolean;
  type: "expense" | "income";
  amountCents: number | null;
  categoryId: string | null;
  categorySource: CategorySource | null;
  accountId: string | null;
  merchant: string | null;
  description: string | null;
  date: string;
  confidence: CaptureConfidence;
  source: "quick_text" | "voice" | "receipt";
  reference?: string | null;
  /** The user picked/changed the category themselves in the preview. */
  categoryConfirmedByUser: boolean;
}

export function effectiveSmartIntent(draft: CaptureDraft): SmartCaptureIntent | null {
  if (!draft.smart) return null;
  const s = { ...draft.smart };
  if (draft.amountCents !== null) {
    if (s.kind === "asset_installment") s.downPaymentCents = draft.amountCents;
    else s.priceCents = draft.amountCents;
  }
  s.principalCents = s.kind === "loan" ? s.priceCents : s.priceCents - s.downPaymentCents;
  try { return resolveSmartCapture(s, draft.date, draft.smartRatePeriod); } catch { return null; }
}

/** Required smart decisions must not be silently skipped in a multi-item save. */
export function smartCaptureNeedsAnswer(draft: CaptureDraft): boolean {
  const s = draft.smart;
  return !!s && ((s.kind === "asset_cash" && s.assetDecision === "ask" && draft.smartAssetAccepted === undefined)
    || (s.ratePeriodNeedsConfirm && !draft.smartRatePeriod));
}

export function canSaveDraft(draft: CaptureDraft): boolean {
  const smart = effectiveSmartIntent(draft);
  if (draft.smart && (!smart || smart.priceCents <= 0 || smart.principalCents < 0)) return false;
  if (smartCaptureNeedsAnswer(draft)) return false;
  const zeroDown = smart?.kind === "asset_installment" && draft.amountCents === 0;
  return !draft.cancelIntent && !draft.subscriptionAccountMissing && draft.amountCents !== null && (draft.amountCents > 0 || zeroDown) && Boolean(draft.accountId);
}

/**
 * Maps a draft to the save payload, following the manual form's own
 * convention (transaction-form.tsx): `merchant` holds "what you paid for"
 * (the field the full form edits, and the key category learning uses);
 * `description` is only kept when it adds something beyond a brand name
 * ("Starbucks" + "coffee"). The transaction list shows description ||
 * merchant, so either way it reads naturally.
 */
export function buildCaptureSaveInput(draft: CaptureDraft, clientRequestId: string): CaptureSaveInput | null {
  if (!canSaveDraft(draft)) return null;
  const merchant = (draft.merchant ?? draft.description)?.trim() || null;
  const description =
    draft.merchant && draft.description && draft.description.trim() !== draft.merchant.trim()
      ? draft.description.trim()
      : null;
  return {
    ...(draft.type === "expense" && draft.subscription && draft.addRecurring !== false && (draft.subscription.serviceName || merchant)
      ? { recurring: { frequency: draft.subscription.frequency, name: draft.subscription.serviceName || merchant! } } : {}),
    clientRequestId,
    type: draft.type,
    amountCents: draft.amountCents!,
    accountId: draft.accountId!,
    categoryId: draft.categoryId,
    merchant: merchant ? merchant.slice(0, 120) : null,
    description: description ? description.slice(0, 200) : null,
    date: draft.date,
    source: draft.source,
    confidence: draft.confidence,
    reference: draft.reference ?? null,
    categoryConfirmedByUser: draft.categoryConfirmedByUser,
  };
}

/** Additive adapter for future capture callers; existing save eligibility is unchanged. */
export function createConfidenceDraft(parsed: ParsedCapture, context: ConfidenceContext, source: CaptureDraft["source"] = "quick_text"): CaptureDraft {
  return { ...parsed, source, categoryConfirmedByUser: false, confidenceGate: evaluateCaptureConfidence(parsed, context) };
}
