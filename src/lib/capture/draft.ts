import type { CaptureConfidence } from "@/types/database";
import type { CategorySource } from "./transaction-parser";
import type { CaptureSaveInput } from "@/lib/validation/capture";

/** What the Quick Capture preview card shows and lets the user adjust before saving. */
export interface CaptureDraft {
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

export function canSaveDraft(draft: CaptureDraft): boolean {
  return draft.amountCents !== null && draft.amountCents > 0 && Boolean(draft.accountId);
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
