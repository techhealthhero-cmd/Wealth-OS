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
import { hasExplicitSubscriptionIntent, parseCancelIntent, parseSubscriptionIntent, type SubscriptionIntent } from "./subscription-intent";
import { findSpokenDateMention } from "./capture-date";

export interface CaptureAccount {
  id: string;
  name: string;
  account_type: AccountType;
  institution: string | null;
  is_archived: boolean;
  purpose?: string | null;
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

/** "Buy at this shop → pay from this account" (merchant_account_preferences). */
export interface MerchantAccountPreference {
  merchant_normalized: string;
  account_id: string;
}

/** A unit the user is paid (or pays) per: "ดื่ม" = ฿200 income (capture_units, migration 0044). */
export interface CaptureUnit {
  unit_normalized: string;
  unit_label: string;
  unit_price_cents: number;
  type: "expense" | "income";
  category_id: string | null;
}

export interface ParseContext {
  emergencyFundAccountId?: string | null;
  accounts: CaptureAccount[];
  categories: CaptureCategory[];
  merchantPreferences: CaptureMerchantPreference[];
  /** Shops the user pays from a set account ("7-eleven" → their 7-Eleven wallet). */
  merchantAccounts?: MerchantAccountPreference[];
  /** Per-unit prices ("ได้ 10 ดื่ม" → 10 × ฿200). */
  units?: CaptureUnit[];
  /** Local "today" as YYYY-MM-DD (Asia/Bangkok on the client). */
  today: string;
}

export type CategorySource = "learned" | "keyword" | "ai" | "fallback";
/** matched = named in the words · merchant = the shop's set account · default = first account. */
export type AccountSource = "matched" | "merchant" | "subscription" | "default";

export interface ParsedCapture {
  subscription?: SubscriptionIntent | null;
  subscriptionAccountMissing?: boolean;
  cancelIntent?: { serviceQuery: string } | null;
  isEmergencyFundDraw: boolean;
  /** Intent could not resolve an active emergency account. Default retained; not a merchant suggestion. */
  emergencyFundAccountMissing?: boolean;
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
  /**
   * An account whose name matches the shop ("7 - Eleven" for a 7-Eleven
   * purchase) when no account was named and none is set for the shop yet —
   * the UI asks "pay from which account?" instead of guessing.
   */
  suggestedAccountId?: string | null;
  /** "ได้ 10 ดื่ม": the amount is count × the unit's price. */
  unit?: { count: number; label: string; unitPriceCents: number } | null;
  /**
   * "ได้ 10 ดื่ม" with no price known for ดื่ม yet: the number is a COUNT,
   * not baht, so the amount stays empty and the UI asks the price once.
   */
  unknownUnit?: { word: string; count: number } | null;
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

/** Blanks each span with spaces (positions stay put, so overlapping spans are fine). */
function blankSpans(text: string, spans: (Match | null | undefined)[]): string {
  let out = text;
  for (const s of spans) if (s) out = out.slice(0, s.start) + " ".repeat(s.end - s.start) + out.slice(s.end);
  return out;
}

/** Bare เงินสำรอง can mean general savings, so only explicit emergency phrases count. */
const EMERGENCY_SOURCE = /(?:เงินสำรอง\s*ฉุกเฉิน|(?:เงิน)?กระเป๋าสำรอง\s*ฉุกเฉิน|(?:เงิน)?กระเป๋าฉุกเฉิน|เงินฉุกเฉิน|บัญชีฉุกเฉิน|กองทุนฉุกเฉิน|(?<![a-z0-9])emergency(?:\s+fund)?(?![a-z0-9]))/gi;

function stripEmergencySource(text: string): { text: string; detected: boolean } {
  let detected = false;
  const cleaned = text.replace(EMERGENCY_SOURCE, () => {
    detected = true;
    return " ";
  });
  // Only remove chatter immediately adjacent to a recognized source phrase.
  const source = EMERGENCY_SOURCE.source;
  const chatter = new RegExp(`(?:ตอนนี้\\s*)?(?:ใช้\\s*)?(?:${source})(?:\\s*อยู่)?`, "gi");
  return { text: detected ? text.replace(chatter, " ").trim() : cleaned, detected };
}

function emergencyAccount(ctx: ParseContext): string | null {
  const active = ctx.accounts.filter((a) => !a.is_archived);
  return active.find((a) => a.id === ctx.emergencyFundAccountId)?.id
    ?? active.find((a) => stripEmergencySource(`${a.name} ${a.purpose ?? ""}`).detected)?.id
    ?? null;
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
// counted units ("ได้ 10 ดื่ม")
// ---------------------------------------------------------------------------

const COUNT = String.raw`(\d{1,4}(?:\.\d{1,2})?)`;
const PRICE = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(?:บาท|baht|฿|บ\.)?`;
/** Words that are money, never a unit ("ได้ 2 พัน" is 2,000 baht). */
const MONEY_WORDS = ["บาท", "บ.", "พัน", "หมื่น", "แสน", "ล้าน", "สตางค์", "baht"];
/** Trailing chatter glued to the unit word by speech ("ดื่มวันนี้", "ดื่มครับ"). */
const UNIT_TRAILERS = ["วันนี้", "เมื่อวานซืน", "เมื่อวาน", "ครับ", "ค่ะ", "คะ", "นะ", "แล้ว", "จ้า", "จ้ะ", "เลย"];

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function priceCents(whole: string, fraction: string | undefined): number {
  return Number(whole.replace(/,/g, "")) * 100 + (fraction ? Number(fraction.padEnd(2, "0")) : 0);
}

/** "ดื่มละ 250": a price said for one unit, which wins over the saved one. */
function findUnitPrice(lower: string, word: string): { cents: number; span: Match } | null {
  const m = new RegExp(`${escapeRe(word)}\\s*ละ\\s*${PRICE}`).exec(lower);
  if (!m) return null;
  const cents = priceCents(m[1], m[2]);
  return cents > 0 ? { cents, span: { start: m.index, end: m.index + m[0].length } } : null;
}

export interface CountedUnit {
  count: number;
  /** The saved unit, or null for a word the user hasn't priced yet. */
  unit: CaptureUnit | null;
  word: string;
  /** "<count> <word>". */
  span: Match;
  /** A price said in the words ("ดื่มละ 250"), else null. */
  price: { cents: number; span: Match } | null;
}

/**
 * A saved unit right after a number: "ได้ 10 ดื่ม" → 10 ดื่ม. Longest unit
 * word first, so "ดื่มพิเศษ" beats "ดื่ม".
 */
export function findCountedUnit(lower: string, units: CaptureUnit[]): CountedUnit | null {
  for (const unit of [...units].sort((a, b) => b.unit_normalized.length - a.unit_normalized.length)) {
    const m = new RegExp(`${COUNT}\\s*${escapeRe(unit.unit_normalized)}`).exec(lower);
    if (!m || /\d/.test(lower[m.index - 1] ?? "")) continue;
    const count = Number(m[1]);
    if (!(count > 0)) continue;
    return {
      count,
      unit,
      word: unit.unit_normalized,
      span: { start: m.index, end: m.index + m[0].length },
      price: findUnitPrice(lower, unit.unit_normalized),
    };
  }
  return null;
}

/**
 * "ได้ 10 ดื่ม" where ดื่ม isn't a saved unit: after ได้ (got), a count and a
 * Thai word that isn't money and isn't followed by a number of its own
 * ("ได้ 500 ข้าว 50" is two items, not 500 units of rice).
 */
export function findUnknownUnit(lower: string): CountedUnit | null {
  const m = new RegExp(`ได้\\s*${COUNT}\\s*([\\u0E00-\\u0E7F]+)`).exec(lower);
  if (!m) return null;
  let word = m[2];
  for (let changed = true; changed; ) {
    changed = false;
    for (const t of UNIT_TRAILERS) {
      if (word.length > t.length && word.endsWith(t)) {
        word = word.slice(0, -t.length);
        changed = true;
      }
    }
  }
  if (!word || word.length > 12 || MONEY_WORDS.some((w) => word.startsWith(w))) return null;
  const after = lower.slice(m.index + m[0].length).trimStart();
  if (/^\d/.test(after)) return null;
  const countStart = m.index + m[0].indexOf(m[1]);
  return {
    count: Number(m[1]),
    unit: null,
    word,
    span: { start: countStart, end: m.index + m[0].length },
    price: findUnitPrice(lower, word),
  };
}

/**
 * Where a counted unit ends, when a number at `start`–`end` in a recap is
 * its count — so the recap splits after "10 ดื่ม", not after "10". Null when
 * the number is not a count.
 */
export function countedUnitEnd(text: string, start: number, end: number, unitWords: string[]): number | null {
  const lower = text.toLowerCase();
  const gap = lower.slice(end).length - lower.slice(end).trimStart().length;
  const after = lower.slice(end + gap);
  const known = [...unitWords].sort((a, b) => b.length - a.length).find((u) => after.startsWith(u));
  if (known) return end + gap + known.length;
  if (!lower.slice(0, start).trimEnd().endsWith("ได้")) return null;
  const unknown = findUnknownUnit(`ได้ ${lower.slice(start)}`);
  if (!unknown) return null;
  const word = /^[฀-๿]+/.exec(after)?.[0];
  return word ? end + gap + word.length : null;
}

// ---------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------

function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * The day the text names: a spoken date ("วันที่ 8 ตุลา") first, then
 * เมื่อวาน/เมื่อวานซืน/yesterday, then วันนี้/today; `named` is false when
 * nothing was said (the date is just today by default). `span` is set only
 * for a spoken date — the relative words are removed as filler words.
 */
export function extractCaptureDate(lower: string, today: string): { date: string; named: boolean; span: Match | null } {
  const spoken = findSpokenDateMention(lower, today);
  if (spoken) return { date: spoken.date ?? today, named: true, span: { start: spoken.start, end: spoken.end } };
  if (lower.includes("เมื่อวานซืน")) return { date: shiftDate(today, -2), named: true, span: null };
  if (lower.includes("เมื่อวาน") || /(?<![a-z])yesterday(?![a-z])/.test(lower)) return { date: shiftDate(today, -1), named: true, span: null };
  const named = lower.includes("วันนี้") || /(?<![a-z])today(?![a-z])/.test(lower);
  return { date: today, named, span: null };
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

function keywordCategory(text: string, merchant: string | null, type: "expense" | "income", ctx: ParseContext): CaptureCategory | null {
  const dictionary = type === "income" ? INCOME_CATEGORY_KEYWORDS : EXPENSE_CATEGORY_KEYWORDS;
  const hit = longestMatch(
    `${normalizeText(text).toLowerCase()} ${merchant ? merchant.toLowerCase() : ""}`.trim(),
    Object.entries(dictionary).map(([key, keywords]) => ({ value: key, keywords }))
  );
  return hit ? categoryByKey(ctx, hit.value, type) : null;
}

function shouldUseSubscriptionDefaults(text: string, merchant: string | null, ctx: ParseContext): boolean {
  return hasExplicitSubscriptionIntent(text) || !keywordCategory(text, merchant, "expense", ctx);
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

  // Learned preferences win. Cadence-only bills keep their generic keyword category.
  const accountMention = matchAccount(text, ctx.accounts);
  const subscriptionText = accountMention?.span ? removeSpan(normalizeText(text), accountMention.span) : text;
  if (type === "expense" && parseSubscriptionIntent(subscriptionText) && shouldUseSubscriptionDefaults(subscriptionText, merchant, ctx)) {
    const pool = ctx.categories.filter((c) => c.type === "expense" || c.type === "both");
    const subscription = categoryByKey(ctx, "Subscriptions", type)
      ?? pool.find((c) => /subscription|สมาชิก|ซับ|บริการรายเดือน/i.test(`${c.name_en} ${c.name_th}`))
      ?? ["Entertainment", "Bills", "Utilities"].map((key) => categoryByKey(ctx, key, type)).find(Boolean);
    if (subscription) return { categoryId: subscription.id, source: "keyword" };
  }

  // 2) keywords
  const category = keywordCategory(text, merchant, type, ctx);
  if (category) return { categoryId: category.id, source: "keyword" };

  // 3) fallback
  const other = categoryByKey(ctx, "Other", type);
  return { categoryId: other?.id ?? null, source: other ? "fallback" : null };
}

/** A name squeezed for comparing: "7 - Eleven", "7-Eleven" and "7eleven" all become "7eleven". */
function compactName(text: string): string {
  return normalizeMerchant(text).replace(/[\s\-&+]/g, "");
}

/** The shop words refer to, as stored: "เซเว่น" → { key: "7-eleven", label: "7-Eleven" }. */
export function shopKey(text: string): { key: string; label: string } {
  const hit = findKnownMerchant(normalizeText(text).toLowerCase());
  const label = hit?.name ?? normalizeText(text).slice(0, 120);
  return { key: normalizeMerchant(label), label };
}

/**
 * The account set for this shop: the known brand's own setting first, then
 * any set shop named in the words ("ร้านกาแฟป้าแดง 45"). Archived accounts
 * never count.
 */
export function accountForMerchant(
  text: string,
  merchant: string | null,
  prefs: MerchantAccountPreference[],
  accounts: CaptureAccount[]
): string | null {
  const active = new Set(accounts.filter((a) => !a.is_archived).map((a) => a.id));
  const valid = prefs.filter((p) => active.has(p.account_id));
  if (valid.length === 0) return null;
  if (merchant) {
    const key = normalizeMerchant(merchant);
    const hit = valid.find((p) => p.merchant_normalized === key);
    if (hit) return hit.account_id;
  }
  const normalized = normalizeMerchant(text);
  const inText = valid
    .filter((p) => p.merchant_normalized.length >= 3)
    .sort((a, b) => b.merchant_normalized.length - a.merchant_normalized.length)
    .find((p) => findKeyword(normalized, p.merchant_normalized));
  return inText?.account_id ?? null;
}

/** Active accounts whose NAME is the shop's ("7 - Eleven", "7-Eleven Wallet" for 7-Eleven). */
export function accountsNamedForMerchant(merchant: string, accounts: CaptureAccount[]): string[] {
  const entry = KNOWN_MERCHANTS.find((m) => m.name === merchant);
  const keys = [merchant, ...(entry?.match ?? [])].map(compactName).filter((k) => k.length >= 3);
  return accounts.filter((a) => !a.is_archived && keys.some((k) => compactName(a.name).includes(k))).map((a) => a.id);
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
  return (
    text.startsWith("+") ||
    INCOME_MARKERS.some((m) => findKeyword(text, m) !== null) ||
    isIncomingTransfer(text) ||
    MONEY_IN_RE.test(text)
  );
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

/** "I/we" — the speaker is the one sending money. */
const SELF_PRONOUNS = ["ฉัน", "เรา", "ผม", "หนู", "กู", "i"];
/** "โอนเงินให้แม่" — a person right after ให้ is who RECEIVED it (an expense). */
const RECIPIENT_WORDS = [
  "แม่", "พ่อ", "พี่", "น้อง", "แฟน", "เพื่อน", "ลูก", "ยาย", "ตา", "ปู่", "ย่า", "ป้า", "ลุง", "น้า", "อา", "เขา",
  "คน", "ร้าน", "ลูกค้า", "เจ้าของ", "บ้าน",
];

/**
 * Money a SOMEONE ELSE sent me. Reported 2026-10-05: "อ๋องโอนเงินมาคืน",
 * "ตี๋โอนเงินมาให้", "พี่เจนโอนเงินให้ค่าวันเกิด" were all read as expenses.
 *  - "โอน(เงิน)มา…" always comes TO me.
 *  - "<someone>โอน(เงิน)ให้/คืน…" — a named sender who isn't me, and no
 *    recipient after ให้ ("ฉันโอนเงินให้แม่" stays an expense).
 */
function isIncomingTransfer(lower: string): boolean {
  const m = /โอน(?:เงิน)?\s*(มา|คืน|ให้)/.exec(lower);
  if (!m) return false;
  if (m[1] === "มา") return true;
  const subject = lower.slice(0, m.index).trim();
  if (!subject || SELF_PRONOUNS.some((p) => (p === "i" ? /^i(?:\s|$)/.test(subject) : subject.startsWith(p)))) return false;
  const after = lower.slice(m.index + m[0].length).trim();
  return !RECIPIENT_WORDS.some((w) => after.startsWith(w));
}

/**
 * "เงินแท็ก 1-15 ก.ย. เข้า 25,400" / "ฝากเข้า 5000": the word เข้า on its own
 * (or ฝาก…เข้า / เข้าบัญชี) means money came INTO my account. "ค่าเข้า"
 * (an entrance fee) is one word, so it never matches. "เงินมา 2000" (money
 * came in) too — but not "เงินมาก" (a lot of money).
 */
const MONEY_IN_RE = /(?:^|\s)(?:เข้า|ฝากเข้า|เข้าบัญชี|ฝากเงิน)(?=\s|\d|$)|เงินมา(?!ก)/;

function detectType(lower: string): "expense" | "income" {
  if (lower.startsWith("+")) return "income";
  const text = withoutSellerPhrases(lower);
  if (INCOME_MARKERS.some((m) => findKeyword(text, m))) return "income";
  if (isIncomingTransfer(text) || MONEY_IN_RE.test(text)) return "income";
  const incomeHit = longestMatch(
    text,
    // Gift words describe both directions (a gift I got / one I gave), so
    // they pick the category but never flip an expense to income.
    Object.entries(INCOME_CATEGORY_KEYWORDS)
      .filter(([key]) => key !== "Gift")
      .map(([, keywords]) => ({ value: true, keywords }))
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
  out = out.replace(/[฿,:;!?()"+]/g, " ");
  // Dots go too — except inside Thai abbreviations ("ก.ย.", "ม.ค."), which
  // otherwise turned into a meaningless "ก ย".
  out = out
    .split(/\s+/)
    .map((token) => (/^(?:[ก-ฮ]{1,2}\.)+[ก-ฮ]?$/.test(token) ? token : token.replace(/\./g, " ")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
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
  const cancelIntent = parseCancelIntent(normalizeText(input));
  if (cancelIntent) return {
    cancelIntent, isEmergencyFundDraw: false, type: "expense", amountCents: null,
    categoryId: null, categorySource: null, accountId: null, accountSource: null,
    merchant: null, description: null, date: ctx.today, confidence: "low", missing: ["amount", "account"],
  };
  const emergency = stripEmergencySource(normalizeText(input));
  const text = emergency.text;
  const lower = text.toLowerCase();
  const detectedType = detectType(lower);
  const dateHit = extractCaptureDate(lower, ctx.today);
  const date = dateHit.date;

  // A spoken date ("วันที่ 8 ตุลาคม") goes first, so its day can't become
  // the amount or stay in the description.
  const dated = dateHit.span ? removeSpan(text, dateHit.span) : text;
  const datedLower = dated.toLowerCase();

  // Remove the brand first so digits inside it ("7-11", "3BB") can't be
  // read as the amount; keep the original text for description building.
  const merchantHit = findKnownMerchant(datedLower);
  let working = merchantHit ? removeSpan(dated, merchantHit.span) : dated;

  const accountHit = matchAccount(working, ctx.accounts);
  if (accountHit?.span) working = removeSpan(working, accountHit.span);

  // "ได้ 10 ดื่ม": a count of a unit, not baht — priced by the saved unit
  // (or "ดื่มละ 250" said right there), else left for the user to price.
  const workingLower = working.toLowerCase();
  const counted =
    findCountedUnit(workingLower, ctx.units ?? []) ??
    (() => {
      const unknown = findUnknownUnit(workingLower);
      // Another number in the item is its price ("ขายได้ 2 ชิ้น 300"): no count.
      if (!unknown || (!unknown.price && extractAmount(blankSpans(working, [unknown.span])))) return null;
      return unknown;
    })();
  const perUnitCents = counted ? (counted.price?.cents ?? counted.unit?.unit_price_cents ?? null) : null;
  if (counted) working = blankSpans(working, [counted.span, counted.price?.span]);

  const amountHit = counted ? null : extractAmount(working);
  if (amountHit) working = removeSpan(working, amountHit.span);
  const amountCents = counted
    ? perUnitCents !== null
      ? Math.round(counted.count * perUnitCents)
      : null
    : (amountHit?.cents ?? null);

  const namedAccountSpan = accountHit ? matchAccount(dated, ctx.accounts)?.span : null;
  const subscriptionText = namedAccountSpan ? removeSpan(dated, namedAccountSpan) : dated;
  const subscription = parseSubscriptionIntent(subscriptionText);
  const subscriptionMerchant = subscription?.serviceName ?? merchantHit?.name ?? null;
  const subscriptionDefaults = !!subscription && shouldUseSubscriptionDefaults(subscriptionText, subscriptionMerchant, ctx);
  const merchant = subscriptionDefaults ? subscriptionMerchant : merchantHit?.name ?? null;
  const description = subscriptionDefaults ? merchant : counted
    ? `${counted.count} ${counted.unit?.unit_label ?? counted.word}`
    : (cleanDescription(working) ?? merchant);
  // Learning decides the TYPE too: once the user has filed "แม่ให้" under an
  // income category, the same words read as income next time even without
  // an explicit marker. Explicit markers ("+", "รายรับ") still win. A unit
  // carries its own type; an unpriced "ได้ N <unit>" is something received.
  const type = subscription ? "expense" : counted
    ? (counted.unit?.type ?? "income")
    : learnedTypeOverride(lower, text, merchant, detectedType, ctx);
  const unitCategory = counted?.unit?.category_id
    ? ctx.categories.find((c) => c.id === counted.unit!.category_id && (c.type === type || c.type === "both"))
    : undefined;
  const category: CategorySuggestion = unitCategory
    ? { categoryId: unitCategory.id, source: "learned" }
    : suggestCategory(text, merchant, type, ctx);
  // No account named: the shop's own account ("เซเว่น" → the 7-Eleven
  // wallet), then the standing default. An account merely NAMED like the
  // shop is only suggested — the user confirms it once.
  const shopAccount = accountHit ? null : accountForMerchant(text, merchant, ctx.merchantAccounts ?? [], ctx.accounts);
  const isEmergencyFundDraw = emergency.detected && type === "expense";
  const emergencyId = isEmergencyFundDraw ? emergencyAccount(ctx) : null;
  const emergencyFundAccountMissing = isEmergencyFundDraw && !emergencyId;
  const subscriptionId = subscriptionDefaults ? ctx.accounts.find((a) => !a.is_archived && /\bsub(scription)?s?\b|ซับ|สมาชิก|รายเดือน/i.test(`${a.name} ${a.purpose ?? ""}`))?.id : null;
  const subscriptionAccountMissing = subscriptionDefaults && !accountHit && !shopAccount && !subscriptionId && !isEmergencyFundDraw;
  const accountId = isEmergencyFundDraw
    ? emergencyId ?? defaultAccountId(ctx.accounts)
    : accountHit?.accountId ?? shopAccount ?? subscriptionId ?? defaultAccountId(ctx.accounts);
  const suggestedAccountId =
    !subscriptionDefaults && !isEmergencyFundDraw && !accountHit && !shopAccount && merchant
      ? (accountsNamedForMerchant(merchant, ctx.accounts).find((id) => id !== accountId) ?? null)
      : null;

  const missing: ParsedCapture["missing"] = [];
  if (amountCents === null) missing.push("amount");
  if (!category.categoryId || category.source === "fallback") missing.push("category");
  if (!accountId) missing.push("account");

  const confidence: CaptureConfidence = amountCents === null || !accountId
    ? "low"
    : category.source === "fallback" || !category.categoryId
      ? "medium"
      : "high";

  return {
    subscription,
    subscriptionAccountMissing,
    isEmergencyFundDraw,
    emergencyFundAccountMissing,
    type,
    amountCents,
    categoryId: category.categoryId,
    categorySource: category.source,
    accountId,
    accountSource: isEmergencyFundDraw
      ? emergencyId ? "matched" : accountId ? "default" : null
      : accountHit ? "matched" : shopAccount ? "merchant" : subscriptionId ? "subscription" : accountId ? "default" : null,
    merchant,
    description,
    date,
    confidence,
    missing,
    suggestedAccountId,
    unit:
      counted && perUnitCents !== null
        ? { count: counted.count, label: counted.unit?.unit_label ?? counted.word, unitPriceCents: perUnitCents }
        : null,
    unknownUnit: counted && perUnitCents === null ? { word: counted.word, count: counted.count } : null,
  };
}
