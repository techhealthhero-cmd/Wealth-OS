/**
 * Deterministic natural-language expense parser for Quick Capture.
 *
 *   "ข้าว 80 cash"  →  expense · ฿80 · Food · Cash · "ข้าว" · today
 *
 * Pure (no I/O, no LLM): everything it needs — the user's accounts,
 * categories and learned merchant→category preferences — is passed in, so
 * it runs instantly on the client, costs nothing, and is fully unit-tested.
 * An LLM-based parser can be layered on later behind the same
 * `ParsedCapture` shape without changing any UI.
 *
 * Money is handled in integer satang (cents) end to end, like the rest of
 * the app's financial code — never floats.
 */
import type { AccountType, CaptureConfidence, CategoryType } from "@/types/database";
import {
  ACCOUNT_HINTS,
  EXPENSE_CATEGORY_KEYWORDS,
  FILLER_WORDS,
  INCOME_CATEGORY_KEYWORDS,
  INCOME_MARKERS,
  KNOWN_MERCHANTS,
  LEADING_VERBS,
} from "./keywords";

export interface CaptureAccount {
  id: string;
  name: string;
  account_type: AccountType;
  institution: string | null;
  is_archived: boolean;
}

export interface CaptureCategory {
  id: string;
  name_th: string;
  name_en: string;
  type: CategoryType;
  icon: string | null;
  is_system: boolean;
}

export interface CaptureMerchantPreference {
  merchant_normalized: string;
  category_id: string;
}

export interface ParseContext {
  accounts: CaptureAccount[];
  categories: CaptureCategory[];
  merchantPreferences: CaptureMerchantPreference[];
  /** Local "today" as YYYY-MM-DD (Asia/Bangkok on the client). */
  today: string;
}

export type CategorySource = "learned" | "keyword" | "ai" | "fallback";
export type AccountSource = "matched" | "default";

export interface ParsedCapture {
  type: "expense" | "income";
  amountCents: number | null;
  categoryId: string | null;
  categorySource: CategorySource | null;
  accountId: string | null;
  accountSource: AccountSource | null;
  merchant: string | null;
  description: string | null;
  date: string;
  confidence: CaptureConfidence;
  /** Fields the user may want to fill — never blocks saving except `amount`. */
  missing: ("amount" | "category" | "account")[];
}

// ---------------------------------------------------------------------------
// text helpers
// ---------------------------------------------------------------------------

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

export function normalizeText(input: string): string {
  let out = "";
  for (const ch of input) {
    const i = THAI_DIGITS.indexOf(ch);
    out += i >= 0 ? String(i) : ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Key used for merchant → category learning: lowercase, punctuation-light,
 * single-spaced. "  GRAB  " and "grab" learn into the same row.
 */
export function normalizeMerchant(input: string): string {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}+&\- ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

const LATIN = /[a-z0-9]/i;

export interface Match {
  start: number;
  end: number;
}

/**
 * Finds `keyword` in `lower` (already lowercased). Latin keywords need word
 * boundaries ("pea" must not match "peanut"); Thai keywords match as
 * substrings (Thai has no word spaces), except very short ones (≤2 chars)
 * which must be a whole space-separated token.
 */
export function findKeyword(lower: string, keyword: string): Match | null {
  const kw = keyword.toLowerCase();
  if (LATIN.test(kw)) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").exec(lower);
    return m ? { start: m.index, end: m.index + m[0].length } : null;
  }
  if (kw.length <= 2) {
    const tokens = lower.split(" ");
    let pos = 0;
    for (const token of tokens) {
      if (token === kw) return { start: pos, end: pos + token.length };
      pos += token.length + 1;
    }
    return null;
  }
  const idx = lower.indexOf(kw);
  return idx >= 0 ? { start: idx, end: idx + kw.length } : null;
}

function removeSpan(text: string, span: Match): string {
  return `${text.slice(0, span.start)} ${text.slice(span.end)}`;
}

// ---------------------------------------------------------------------------
// amount
// ---------------------------------------------------------------------------

const AMOUNT_RE =
  /(?:฿\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(k|พัน|หมื่น|แสน|ล้าน)?(?![\d])\s*(บาท|baht|thb|฿|บ\.)?/gi;

/** Spoken Thai magnitudes ("2 หมื่น" = 20,000) as well as "20k". */
const AMOUNT_MULTIPLIER: Record<string, number> = { k: 1_000, พัน: 1_000, หมื่น: 10_000, แสน: 100_000, ล้าน: 1_000_000 };

/** The amount pattern, shared with the multi-item recap splitter (global flag — use with matchAll). */
export const AMOUNT_PATTERN = AMOUNT_RE;

/** Extracts the amount in satang plus the span it occupied, or null. */
export function extractAmount(text: string): { cents: number; span: Match } | null {
  const candidates: { cents: number; span: Match; hasCurrency: boolean }[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const whole = Number(m[1].replace(/,/g, ""));
    const fraction = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
    if (!Number.isFinite(whole)) continue;
    let cents = whole * 100 + fraction;
    if (m[3]) cents *= AMOUNT_MULTIPLIER[m[3].toLowerCase()] ?? 1;
    if (cents <= 0 || cents >= 10 ** 15) continue;
    const hasCurrency = Boolean(m[4]) || m[0].trimStart().startsWith("฿");
    candidates.push({ cents, span: { start: m.index!, end: m.index! + m[0].length }, hasCurrency });
  }
  if (candidates.length === 0) return null;
  // A number written with a currency marker wins; otherwise the LAST number
  // ("ข้าว 2 จาน 120" → 120 is the price, 2 is a quantity).
  const withCurrency = candidates.filter((c) => c.hasCurrency);
  const pick = withCurrency.length ? withCurrency[withCurrency.length - 1] : candidates[candidates.length - 1];
  return { cents: pick.cents, span: pick.span };
}

// ---------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------

function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function extractDate(lower: string, today: string): string {
  if (lower.includes("เมื่อวานซืน")) return shiftDate(today, -2);
  if (lower.includes("เมื่อวาน") || /(?<![a-z])yesterday(?![a-z])/.test(lower)) return shiftDate(today, -1);
  return today;
}

// ---------------------------------------------------------------------------
// merchant / category / account
// ---------------------------------------------------------------------------

function longestMatch<T>(lower: string, entries: { value: T; keywords: string[] }[]): { value: T; span: Match; length: number } | null {
  let best: { value: T; span: Match; length: number } | null = null;
  for (const entry of entries) {
    for (const kw of entry.keywords) {
      const span = findKeyword(lower, kw);
      if (span && (!best || kw.length > best.length)) best = { value: entry.value, span, length: kw.length };
    }
  }
  return best;
}

export function findKnownMerchant(lower: string): { name: string; span: Match } | null {
  const hit = longestMatch(
    lower,
    KNOWN_MERCHANTS.map((m) => ({ value: m.name, keywords: m.match }))
  );
  return hit ? { name: hit.value, span: hit.span } : null;
}

function categoryByKey(ctx: ParseContext, key: string, type: "expense" | "income"): CaptureCategory | null {
  const pool = ctx.categories.filter((c) => c.type === type || c.type === "both");
  // Prefer the system category the key names; fall back to a user category
  // with the same English name.
  return (
    pool.find((c) => c.is_system && c.name_en === key) ??
    pool.find((c) => c.name_en.toLowerCase() === key.toLowerCase()) ??
    null
  );
}

export interface CategorySuggestion {
  categoryId: string | null;
  source: CategorySource | null;
}

/**
 * Category for a capture: the user's learned preference for this merchant
 * first, then the keyword dictionary, then the type's "Other" category.
 * Exported so receipt/slip results get the exact same suggestion logic.
 */
export function suggestCategory(
  text: string,
  merchant: string | null,
  type: "expense" | "income",
  ctx: ParseContext
): CategorySuggestion {
  const validIds = new Set(ctx.categories.filter((c) => c.type === type || c.type === "both").map((c) => c.id));
  const lower = normalizeText(text).toLowerCase();

  // 1) learned — exact merchant key first, then any learned key present in the text.
  // Stored keys are normalizeMerchant() output, so the text is searched in that
  // same normalized form — searching raw text missed any key whose punctuation
  // was stripped ("TEST_WEALTHOS_QX" → "testwealthosqx", "Joe's" → "joes").
  const normalizedText = normalizeMerchant(text);
  const keys = [merchant ? normalizeMerchant(merchant) : null, normalizedText].filter(Boolean) as string[];
  for (const key of keys) {
    const pref = ctx.merchantPreferences.find((p) => p.merchant_normalized === key && validIds.has(p.category_id));
    if (pref) return { categoryId: pref.category_id, source: "learned" };
  }
  const learnedInText = ctx.merchantPreferences
    .filter((p) => validIds.has(p.category_id) && p.merchant_normalized.length >= 3)
    .sort((a, b) => b.merchant_normalized.length - a.merchant_normalized.length)
    .find((p) => findKeyword(normalizedText, p.merchant_normalized));
  if (learnedInText) return { categoryId: learnedInText.category_id, source: "learned" };

  // 2) keywords
  const dictionary = type === "income" ? INCOME_CATEGORY_KEYWORDS : EXPENSE_CATEGORY_KEYWORDS;
  const hit = longestMatch(
    `${lower} ${merchant ? merchant.toLowerCase() : ""}`.trim(),
    Object.entries(dictionary).map(([key, keywords]) => ({ value: key, keywords }))
  );
  if (hit) {
    const category = categoryByKey(ctx, hit.value, type);
    if (category) return { categoryId: category.id, source: "keyword" };
  }

  // 3) fallback
  const other = categoryByKey(ctx, "Other", type);
  return { categoryId: other?.id ?? null, source: other ? "fallback" : null };
}

/** First active account — the app's standing default (see transaction-form.tsx). */
export function defaultAccountId(accounts: CaptureAccount[]): string | null {
  return accounts.find((a) => !a.is_archived)?.id ?? null;
}

/**
 * Account named in the text: an exact account-name mention wins, then a
 * payment-method hint ("cash", "KBank", "บัตรเครดิต") resolved against the
 * user's own accounts. Exported for receipt/slip results ("paid via KBank").
 */
export function matchAccount(text: string, accounts: CaptureAccount[]): { accountId: string; span: Match | null } | null {
  const active = accounts.filter((a) => !a.is_archived);
  const lower = normalizeText(text).toLowerCase();

  const byName = active
    .filter((a) => a.name.trim().length >= 2)
    .map((a) => ({ account: a, span: findKeyword(lower, a.name.trim().toLowerCase()) }))
    .filter((x): x is { account: CaptureAccount; span: Match } => x.span !== null)
    .sort((a, b) => b.account.name.length - a.account.name.length)[0];
  if (byName) return { accountId: byName.account.id, span: byName.span };

  let best: { accountId: string; span: Match; length: number } | null = null;
  for (const hint of ACCOUNT_HINTS) {
    for (const phrase of hint.phrases) {
      const span = findKeyword(lower, phrase);
      if (!span || (best && phrase.length <= best.length)) continue;
      const account = active.find((a) => {
        if (hint.type && a.account_type === hint.type) return true;
        if (!hint.aliases) return false;
        const haystack = `${a.name} ${a.institution ?? ""}`.toLowerCase();
        return hint.aliases.some((alias) => haystack.includes(alias.toLowerCase()));
      });
      if (account) best = { accountId: account.id, span, length: phrase.length };
    }
  }
  return best ? { accountId: best.accountId, span: best.span } : null;
}

/**
 * "ขาย" means I SOLD something ("ขายตูด 500" = income) — except where it only
 * names a shop or seller I bought from ("ร้านขายยา 120", "ซื้อจากคนขาย").
 * Those phrases are removed before looking for income words.
 */
const SELLER_PHRASES = ["ร้านขาย", "ที่ขาย", "คนขาย", "พ่อค้า", "แม่ค้า", "ซื้อขาย"];

function withoutSellerPhrases(lower: string): string {
  let out = lower;
  for (const phrase of SELLER_PHRASES) out = out.split(phrase).join(" ");
  return out;
}

function hasExplicitIncomeMarker(lower: string): boolean {
  const text = withoutSellerPhrases(lower);
  return text.startsWith("+") || INCOME_MARKERS.some((m) => findKeyword(text, m) !== null);
}

/** Flips the detected type only when a learned preference of the OTHER type matches and none of this type does. */
function learnedTypeOverride(
  lower: string,
  text: string,
  merchant: string | null,
  detected: "expense" | "income",
  ctx: ParseContext
): "expense" | "income" {
  if (ctx.merchantPreferences.length === 0) return detected;
  const other = detected === "expense" ? "income" : "expense";
  if (other === "expense" && hasExplicitIncomeMarker(lower)) return detected;
  if (suggestCategory(text, merchant, detected, ctx).source === "learned") return detected;
  return suggestCategory(text, merchant, other, ctx).source === "learned" ? other : detected;
}

function detectType(lower: string): "expense" | "income" {
  if (lower.startsWith("+")) return "income";
  const text = withoutSellerPhrases(lower);
  if (INCOME_MARKERS.some((m) => findKeyword(text, m))) return "income";
  const incomeHit = longestMatch(
    text,
    Object.values(INCOME_CATEGORY_KEYWORDS).map((keywords) => ({ value: true, keywords }))
  );
  return incomeHit ? "income" : "expense";
}

function cleanDescription(text: string): string | null {
  let out = ` ${text} `;
  for (const filler of [...FILLER_WORDS].sort((a, b) => b.length - a.length)) {
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Latin: word boundaries. Short Thai (≤2 chars, e.g. "คะ", "นะ"): whole
    // space-separated token only, so they're never cut out of real words
    // ("คะแนน"). Longer Thai fillers: substring (Thai has no word spaces).
    const pattern = LATIN.test(filler)
      ? new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "gi")
      : filler.length <= 2
        ? new RegExp(`(?<=\\s)${escaped}(?=\\s)`, "g")
        : new RegExp(escaped, "g");
    out = out.replace(pattern, " ");
  }
  // Apostrophes stay ("Joe's Diner"): turning them into a space here made the
  // learned key "joe s diner" while normalizeMerchant() of the typed text
  // gives "joes diner", so the preference never matched again.
  out = out.replace(/[฿,.:;!?()"+]/g, " ").replace(/\s+/g, " ").trim();
  for (const verb of LEADING_VERBS) {
    if (out.toLowerCase().startsWith(verb) && out.length > verb.length) {
      out = out.slice(verb.length).trim();
      break;
    }
  }
  return out.length > 0 ? out.slice(0, 200) : null;
}

// ---------------------------------------------------------------------------
// main entry
// ---------------------------------------------------------------------------

export function parseCaptureText(input: string, ctx: ParseContext): ParsedCapture {
  const text = normalizeText(input);
  const lower = text.toLowerCase();
  const detectedType = detectType(lower);
  const date = extractDate(lower, ctx.today);

  // Remove the brand first so digits inside it ("7-11", "3BB") can't be
  // read as the amount; keep the original text for description building.
  const merchantHit = findKnownMerchant(lower);
  let working = merchantHit ? removeSpan(text, merchantHit.span) : text;

  const accountHit = matchAccount(working, ctx.accounts);
  if (accountHit?.span) working = removeSpan(working, accountHit.span);

  const amountHit = extractAmount(working);
  if (amountHit) working = removeSpan(working, amountHit.span);

  const merchant = merchantHit?.name ?? null;
  const description = cleanDescription(working) ?? merchant;
  // Learning decides the TYPE too: once the user has filed "แม่ให้" under an
  // income category, the same words read as income next time even without
  // an explicit marker. Explicit markers ("+", "รายรับ") still win.
  const type = learnedTypeOverride(lower, text, merchant, detectedType, ctx);
  const category = suggestCategory(text, merchant, type, ctx);
  const accountId = accountHit?.accountId ?? defaultAccountId(ctx.accounts);

  const missing: ParsedCapture["missing"] = [];
  if (!amountHit) missing.push("amount");
  if (!category.categoryId || category.source === "fallback") missing.push("category");
  if (!accountId) missing.push("account");

  const confidence: CaptureConfidence = !amountHit || !accountId
    ? "low"
    : category.source === "fallback" || !category.categoryId
      ? "medium"
      : "high";

  return {
    type,
    amountCents: amountHit?.cents ?? null,
    categoryId: category.categoryId,
    categorySource: category.source,
    accountId,
    accountSource: accountHit ? "matched" : accountId ? "default" : null,
    merchant,
    description,
    date,
    confidence,
    missing,
  };
}
