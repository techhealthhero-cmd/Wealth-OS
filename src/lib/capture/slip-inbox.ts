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
import { ACCOUNT_HINTS } from "./keywords";
import { classifySlipMovement } from "./own-money";
import { accountsMatchingMask, visibleDigits, type ReceiptExtraction } from "./receipt-normalize";
import { normalizeAlias } from "./transfer";
import {
  accountForMerchant,
  matchAccount,
  normalizeMerchant,
  normalizeText,
  suggestCategory,
  type CaptureAccount,
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

/** Which reader produced a slip_inbox row. 2 = memo + paying account. 3 = sender/receiver names, banks and both account masks. */
export const SLIP_READ_VERSION = 3;

/**
 * A database without migration 0047's columns yet: Postgres 42703
 * (unknown column in a select/filter) or PostgREST PGRST204 (unknown column
 * in an insert/update). Callers then retry in the 0046 shape, so deploying
 * before `db push` never breaks the Shortcut.
 */
export function isMissingSlipColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

export interface SlipSuggestion {
  accountId: string | null;
  /** The user's other account, when the slip moves money into it. */
  toAccountId: string | null;
  categoryId: string | null;
  confidence: CaptureConfidence;
  /** True when this slip is the user's own money moving, not spending. */
  ownMoney: boolean;
}

/** A remembered name for one of the user's accounts (account_aliases, 0041). */
export interface SlipAccountAlias {
  alias_normalized: string;
  account_id: string;
}

export interface SlipPayer {
  /** The bank/app alone, canonical: "kbank". */
  bank: string;
  /** "kbank 8710" when the slip shows the paying account's digits. */
  specific: string | null;
  /** Most specific first: "kbank 8710", then "kbank", then the bank's other names. */
  keys: string[];
  /** What gets remembered, as shown in the account's nicknames: "KBank 8710". */
  label: string;
}

/**
 * Who paid, as names an account can be remembered by. The bank/app is
 * reduced to one canonical word ("K PLUS", "Kasikorn", "กสิกร" → "kbank") so
 * every way a slip prints it lands on the same remembered account; the
 * masked account digits make it specific when the user has two accounts at
 * the same bank. Null when the slip names neither.
 */
export function slipPayer(paymentMethod: string | null, payerAccount: string | null): SlipPayer | null {
  const method = paymentMethod ? normalizeText(paymentMethod).toLowerCase() : "";
  const hint = method ? ACCOUNT_HINTS.find((h) => h.aliases && h.phrases.some((p) => method.includes(p))) : undefined;
  const bank = hint ? hint.phrases[0] : normalizeAlias(method);
  if (!bank) return null;
  const label = (paymentMethod ?? bank).trim().slice(0, 40);
  // The visible digits only ("xxxxx8710x" and an older row's "8710" are the same payer).
  const digits = payerAccount ? visibleDigits(payerAccount) : "";
  const specific = digits ? normalizeAlias(`${bank} ${digits}`) : null;
  const keys = [specific, bank, ...(hint?.phrases ?? []).map(normalizeAlias)].filter((k): k is string => Boolean(k));
  return {
    bank,
    specific,
    keys: [...new Set(keys)],
    label: digits ? `${label} ${digits}` : label,
  };
}

/**
 * Two slips paid from the same place: the same account digits when both
 * show them, otherwise the same bank/app.
 */
export function samePayer(a: SlipPayer | null, b: SlipPayer | null): boolean {
  if (!a || !b) return false;
  if (a.specific && b.specific) return a.specific === b.specific;
  return a.bank === b.bank;
}

/**
 * The account whose number fits the slip's paying mask ("xxx-x-x8710-x" fits
 * 123-4-58871-0). The user typed that number, so this beats every guess.
 * Two accounts that both fit → no match (the user picks).
 */
export function accountForPayerNumber(payerAccount: string | null, accounts: CaptureAccount[]): string | null {
  const hits = accountsMatchingMask(payerAccount, accounts);
  return hits.length === 1 ? hits[0].id : null;
}

/** The account remembered for this payer — most specific name first. Archived accounts never count. */
export function accountForPayer(payer: SlipPayer | null, aliases: SlipAccountAlias[], accounts: CaptureAccount[]): string | null {
  if (!payer) return null;
  const active = new Set(accounts.filter((a) => !a.is_archived).map((a) => a.id));
  for (const key of payer.keys) {
    const hit = aliases.find((a) => a.alias_normalized === key && active.has(a.account_id));
    if (hit) return hit.account_id;
  }
  return null;
}

/** Money set aside, by its name — never a blind guess for an everyday payment. */
const SET_ASIDE_NAME = /ฉุกเฉิน|สำรอง|ออม|เก็บ|กันจน|emergency|saving|reserve|invest|ลงทุน/i;
/** Account types a slip is most likely paid from, best first. */
const SLIP_ACCOUNT_TYPE_ORDER = ["bank", "e_wallet", "cash", "credit_card", "other"];

/** An account money is paid from day to day — not savings/investment, not named as set aside. */
function isEverydayAccount(a: CaptureAccount): boolean {
  return !a.is_archived && SLIP_ACCOUNT_TYPE_ORDER.includes(a.account_type) && !SET_ASIDE_NAME.test(a.name);
}

/**
 * The account a slip's bank/app points at — only when exactly ONE everyday
 * account is at that bank. Several ("jar" accounts all at กสิกร: เงินกันจน,
 * เพิ่มสกิล, Subscription…) means the slip can't say which: `ambiguous`, and
 * the user picks once (then it's remembered). `none`: no account at that
 * bank, or the slip names no bank we know.
 */
export function accountForSlipBank(
  paymentMethod: string | null,
  accounts: CaptureAccount[]
): { accountId: string } | "ambiguous" | "none" {
  if (!paymentMethod) return "none";
  const method = normalizeText(paymentMethod).toLowerCase();
  const hint = ACCOUNT_HINTS.find((h) => h.phrases.some((p) => method.includes(p)));
  if (!hint) {
    const named = matchAccount(paymentMethod, accounts);
    const account = named ? accounts.find((a) => a.id === named.accountId) : undefined;
    return account && isEverydayAccount(account) ? { accountId: account.id } : "none";
  }
  const atBank = accounts.filter((a) => {
    if (a.is_archived) return false;
    if (hint.type && a.account_type === hint.type) return true;
    const haystack = `${a.name} ${a.institution ?? ""}`.toLowerCase();
    return (hint.aliases ?? []).some((alias) => haystack.includes(alias.toLowerCase()));
  });
  if (atBank.length === 0) return "none";
  const everyday = atBank.filter(isEverydayAccount);
  return everyday.length === 1 ? { accountId: everyday[0].id } : "ambiguous";
}

/**
 * When nothing on the slip says which account paid: an everyday account
 * (bank, then e-wallet, then cash…), never savings/investment and never one
 * whose name says it's set aside ("เงินกันจน (ฉุกเฉิน)"). Null when there is
 * none — the user picks, rather than money silently leaving their emergency fund.
 */
export function defaultSlipAccountId(accounts: CaptureAccount[]): string | null {
  const everyday = accounts.filter(isEverydayAccount);
  for (const type of SLIP_ACCOUNT_TYPE_ORDER) {
    const hit = everyday.find((a) => a.account_type === type);
    if (hit) return hit.id;
  }
  return null;
}

/**
 * Account and category for a read slip. Account: the account whose number
 * fits the slip's paying mask (accounts.account_number), else the one remembered for
 * this payer (learned when the user picked one on an earlier slip), else the
 * one everyday account at the paying bank — several there means no guess
 * (the user picks) — else the shop's set account, else an everyday account
 * (defaultSlipAccountId) when the slip names no bank we know. Category:
 * a wallet top-up or a transfer to the user themselves → the own-money
 * category, confidently; otherwise learned preferences → keywords (the memo
 * counts: "ชาเขียว" → food) → "Other". A blind "Other" guess never stays "high".
 */
export function suggestSlipFields(
  extraction: ReceiptExtraction,
  ctx: ParseContext & { accountAliases?: SlipAccountAlias[]; ownerName?: string | null }
): SlipSuggestion {
  const merchant = extraction.merchant;
  const text = [extraction.note, merchant].filter(Boolean).join(" ");
  const movement = classifySlipMovement(
    {
      merchant,
      note: extraction.note,
      senderName: extraction.senderName,
      payerAccount: extraction.payerAccount,
      receiverAccount: extraction.receiverAccount,
      receiverBank: extraction.receiverBank,
      amountCents: extraction.amountCents,
    },
    ctx.accounts,
    ctx.categories,
    ctx.ownerName ?? null
  );
  const category = movement.ownMoney && movement.categoryId
    ? { categoryId: movement.categoryId, source: "keyword" as const }
    : suggestCategory(text, merchant, "expense", ctx);
  const remembered = accountForPayer(
    slipPayer(extraction.paymentMethod, extraction.payerAccount),
    ctx.accountAliases ?? [],
    ctx.accounts
  );
  const bank = accountForSlipBank(extraction.paymentMethod, ctx.accounts);
  const shop = merchant ? accountForMerchant(merchant, merchant, ctx.merchantAccounts ?? [], ctx.accounts) : null;
  const accountId =
    accountForPayerNumber(extraction.payerAccount, ctx.accounts) ??
    remembered ??
    (typeof bank === "object" ? bank.accountId : null) ??
    shop ??
    (bank === "none" ? defaultSlipAccountId(ctx.accounts) : null);
  let confidence = extraction.confidence;
  if (movement.ownMoney && extraction.amountCents !== null) confidence = "high";
  else if (confidence === "high" && category.source === "fallback") confidence = "medium";
  return {
    accountId,
    toAccountId: movement.toAccountId,
    categoryId: category.categoryId,
    confidence,
    ownMoney: movement.ownMoney,
  };
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
  /** The slip's memo, as the user left it — saved as the transaction's description. */
  note: z.string().trim().max(200).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Set when the slip already knows the account the money moved into. */
  toAccountId: z.string().uuid().nullable().optional(),
});

export type SlipConfirmInput = z.input<typeof slipConfirmSchema>;

/** Upload limits for the Shortcut endpoint (same image budget as an in-app scan). */
export const SLIP_ENDPOINT_MAX_BYTES = 900 * 1024;
/** Per-key burst limit: a Shortcut sends one slip per request, a few seconds apart. */
export const SLIP_ENDPOINT_BURST = { windowSeconds: 60, maxRequests: 20 } as const;
/** Daily ceiling per user, across the Shortcut and bulk upload. */
export const SLIP_DAILY_LIMIT = 60;
