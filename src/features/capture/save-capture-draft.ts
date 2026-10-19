"use client";
import { saveCapturedTransaction } from "./actions";
import { saveSmartCapture, type SmartCaptureSaveResult } from "./smart-capture-actions";
import { effectiveSmartIntent, type CaptureDraft } from "@/lib/capture/draft";
import type { CaptureSaveInput } from "@/lib/validation/capture";

/** One routing point; declining an optional asset keeps the existing expense path. */
export async function saveCaptureDraft(draft: CaptureDraft, capture: CaptureSaveInput): Promise<SmartCaptureSaveResult> {
  const smart = effectiveSmartIntent(draft);
  return smart && !(smart.kind === "asset_cash" && draft.smartAssetAccepted === false)
    ? saveSmartCapture({ capture, smart, assetAccepted: draft.smartAssetAccepted, ratePeriod: draft.smartRatePeriod })
    : saveCapturedTransaction(capture);
}
