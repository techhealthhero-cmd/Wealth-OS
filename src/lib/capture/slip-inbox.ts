/**
 * Slip inbox — pure rules (no I/O), shared by the iPhone Shortcut endpoint,
 * the in-app bulk upload and the confirm action. See migration 0046.
 *
 * A slip in the inbox is a SUGGESTION, not a transaction: nothing here moves
 * money. Confirming one goes through the normal capture save.
 */
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import type { CaptureConfidence, SlipInboxStatus } from "@/types/database";
import type { ReceiptExtraction } from "./receipt-normalize";
import {
  accountForMerchant,
  defaultAccountId,
  matchAccount,
  normalizeMerchant,
  suggestCategory,
  type ParseContext,
} from "./transaction-parser";

// ---------------------------------------------------------------------------
// capture tokens
// ---------------------------------------------------------------------------

/** Every key starts with this, so a pasted key is recognisable (and greppable in a leak scan). */
export const CAPTURE_TOKEN_PREFIX = "wos_slip_";
const TOKEN_BODY = /^[A-Za-z0-9_-]{43}$/;

/** A fresh key: prefix + 32 random bytes (base64url). Shown to the user once, never stored. */
export function generateCaptureToken(): string {
  return `${CAPTURE_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function isWellFormedCaptureToken(token: string): boolean {
  return token.startsWith(CAPTURE_TOKEN_PREFIX) && TOKEN_BODY.test(token.slice(CAPTURE_TOKEN_PREFIX.length));
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** The last characters, so two keys can be told apart in settings. */
export function captureTokenHint(token: string): string {
  return token.slice(-4);
}

/** "Bearer wos_slip_…" → the token, or null for anything else. */
export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!m || !isWellFormedCaptureToken(m[1])) return null;
  return m[1];
}

export const captureTokenLabelSchema = z.string().trim().min(1).max(60);

/** How many live keys one user may hold (a phone or two, plus a spare). */
export const MAX_ACTIVE_CAPTURE_TOKENS = 5;

// ---------------------------------------------------------------------------
// reading a slip into an inbox row
// ---------------------------------------------------------------------------

export interface SlipSuggestion {
  accountId: string | null;
  categoryId: string | null;
  confidence: CaptureConfidence;
}

/**
 * Account and category for a read slip — the same rules Quick Capture uses
 * for a single scan (quick-capture-sheet.tsx draftFromExtraction): the
 * paying bank/app named on the slip, else the shop's set account, else the
 * first account; category from learned preferences → keywords → "Other".
 * A blind "Other" guess never stays "high".
 */
export function suggestSlipFields(extraction: ReceiptExtraction, ctx: ParseContext): SlipSuggestion {
  const merchant = extraction.merchant;
  const category = suggestCategory(merchant ?? "", merchant, "expense", ctx);
  const accountId =
    (extraction.paymentMethod ? matchAccount(extraction.paymentMethod, ctx.accounts)?.accountId : null) ??
    (merchant ? accountForMerchant(merchant, merchant, ctx.merchantAccounts ?? [], ctx.accounts) : null) ??
    defaultAccountId(ctx.accounts);
  let confidence = extraction.confidence;
  if (confidence === "high" && category.source === "fallback") confidence = "medium";
  return { accountId, categoryId: category.categoryId, confidence };
}

/**
 * What to do with a freshly read image. Not a slip → kept as `not_slip`
 * (so the Shortcut's next look-back never pays to read it again). A slip
 * whose reference number is already on a recorded transaction → `duplicate`.
 * Everything else waits for the user.
 */
export function slipStatusFor(
  extraction: ReceiptExtraction,
  referenceAlreadyRecorded: boolean
): Extract<SlipInboxStatus, "pending" | "duplicate" | "not_slip"> {
  if (!extraction.isPaymentDocument || extraction.amountCents === null) return "not_slip";
  if (referenceAlreadyRecorded) return "duplicate";
  return "pending";
}

export interface DuplicateCandidate {
  id: string;
  amountCents: number;
  date: string;
  merchant: string | null;
  description: string | null;
}

/**
 * Same amount within ±1 day, with a matching merchant (or nothing to compare)
 * — the same rule as checkCaptureDuplicate. Only flags; the user decides.
 */
export function findPossibleDuplicate(
  slip: { amountCents: number; date: string; merchant: string | null },
  candidates: DuplicateCandidate[]
): string | null {
  const center = Date.parse(`${slip.date}T00:00:00Z`);
  const near = candidates.filter(
    (c) => c.amountCents === slip.amountCents && Math.abs(Date.parse(`${c.date}T00:00:00Z`) - center) <= 86_400_000
  );
  if (near.length === 0) return null;
  if (!slip.merchant) return near[0].id;
  const key = normalizeMerchant(slip.merchant);
  const hit = near.find((c) => {
    const other = normalizeMerchant(c.merchant || c.description || "");
    return !other || other.includes(key) || key.includes(other);
  });
  return hit?.id ?? null;
}

// ---------------------------------------------------------------------------
// confirming
// ---------------------------------------------------------------------------

/** What the user may change on a slip before saving it. */
export const slipConfirmSchema = z.object({
  slipId: z.string().uuid(),
  amountCents: z.number().int().positive().lt(10 ** 15),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  merchant: z.string().trim().max(120).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type SlipConfirmInput = z.input<typeof slipConfirmSchema>;

/** Upload limits for the Shortcut endpoint (same image budget as an in-app scan). */
export const SLIP_ENDPOINT_MAX_BYTES = 900 * 1024;
/** Per-key burst limit: a Shortcut sends one slip per request, a few seconds apart. */
export const SLIP_ENDPOINT_BURST = { windowSeconds: 60, maxRequests: 20 } as const;
/** Daily ceiling per user, across the Shortcut and bulk upload. */
export const SLIP_DAILY_LIMIT = 60;
