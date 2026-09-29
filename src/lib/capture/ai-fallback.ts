import { z } from "zod";

import type { CaptureConfidence } from "@/types/database";
import {
  matchAccount,
  normalizeMerchant,
  normalizeText,
  suggestCategory,
  type CaptureCategory,
  type ParseContext,
  type ParsedCapture,
} from "./transaction-parser";

/**
 * Hybrid Quick Capture parsing: the deterministic parser always runs first
 * and stays the source of truth for simple sentences ("ข้าว 80 cash" → 0 AI
 * calls). Only a sentence the rules can't fully explain gets ONE AI pass,
 * and every field the model returns is validated against the user's own
 * text before it may change the draft — the model can re-read the
 * sentence, never add facts that aren't in it.
 */

/** Relative-time phrases the rule parser doesn't resolve (it knows วันนี้/เมื่อวาน/เมื่อวานซืน). */
const UNRESOLVED_TIME_PHRASES = [
  "เมื่อคืน", "คืนก่อน", "เมื่อเช้า", "เมื่อบ่าย", "เมื่อเย็น", "เมื่อตอนเช้า",
  "วันก่อน", "สัปดาห์ที่แล้ว", "สัปดาห์ก่อน", "อาทิตย์ที่แล้ว", "อาทิตย์ก่อน", "เดือนที่แล้ว", "เมื่อวันที่",
  "last night", "this morning", "last week", "days ago", "day ago",
];

export const AI_ASSIST_MAX_TEXT = 300;
/** A leftover description this long (or this many words) means the rules didn't really understand the sentence. */
const MESSY_LEFTOVER_CHARS = 18;
const MESSY_LEFTOVER_WORDS = 4;

/**
 * Should this sentence get one AI pass? Never without an amount (the model
 * must not supply one), never for long pastes, and never for the short,
 * fully-understood sentences that make up most captures.
 */
export function needsAIAssist(text: string, parsed: ParsedCapture): boolean {
  const clean = normalizeText(text);
  if (parsed.amountCents === null || clean.length > AI_ASSIST_MAX_TEXT) return false;
  const lower = clean.toLowerCase();
  if (UNRESOLVED_TIME_PHRASES.some((p) => lower.includes(p))) return true;
  const leftover = (parsed.description ?? "").trim();
  if (leftover.length >= MESSY_LEFTOVER_CHARS || leftover.split(/\s+/).filter(Boolean).length >= MESSY_LEFTOVER_WORDS) {
    return true;
  }
  return parsed.categorySource === "fallback" && leftover.length >= 2;
}

// ---------------------------------------------------------------------------
// prompt + validation (server)
// ---------------------------------------------------------------------------

export function buildAIParseSystemPrompt(today: string, categories: CaptureCategory[]): string {
  const list = categories.map((c) => `- ${c.name_en} (${c.name_th}) [${c.type}]`).join("\n");
  return `You turn ONE short Thai or English sentence about a personal money transaction into JSON.
Today is ${today} (Asia/Bangkok).
Return ONLY one JSON object with exactly these keys:
{"type": "expense"|"income", "amount": number|null, "merchant": string|null, "category": string|null, "payment": string|null, "date": "YYYY-MM-DD"|null, "description": string|null, "confidence": "high"|"medium"|"low"}
Rules:
- amount: only a number written in the sentence. Never compute or guess one.
- merchant: the shop/brand/person name exactly as written in the sentence, else null.
- category: exactly one name_en from this list, or null if none fits:
${list}
- payment: the bank, card, wallet or "cash" named in the sentence (e.g. "กสิกร", "SCB", "บัตรเครดิต"), else null.
- date: resolve relative words against today ("เมื่อคืน"/"last night" = yesterday, "เมื่อเช้า" = today). null if the sentence gives no time.
- description: a short Thai/English label of what it was (max 6 words), without the amount, payment or time words.
- confidence: "high" only if type, amount and category are all clear from the sentence.
Never invent anything that is not in the sentence.`;
}

const aiParseSchema = z.object({
  type: z.enum(["expense", "income"]).nullable().optional(),
  amount: z.union([z.number(), z.string()]).nullable().optional(),
  merchant: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  payment: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional().default("low"),
});

/** Validated AI reading. `null` fields mean "keep what the rule parser found". */
export interface AIParseFields {
  type: "expense" | "income" | null;
  amountCents: number | null;
  merchant: string | null;
  categoryId: string | null;
  payment: string | null;
  date: string | null;
  description: string | null;
  confidence: CaptureConfidence;
}

function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clean(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim();
  if (!v || /^(null|unknown|n\/a|-)$/i.test(v)) return null;
  return v.slice(0, max);
}

/** Every number written in the sentence, in satang — the only amounts the model may return. */
function amountsInText(text: string): Set<number> {
  const out = new Set<number>();
  for (const m of normalizeText(text).matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g)) {
    out.add(Math.round(Number(m[0].replace(/,/g, "")) * 100));
  }
  return out;
}

function toCents(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[฿,\s]|บาท|thb|baht/gi, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Oldest date an AI reading may set — "last week"-style phrases, not archaeology. */
const MAX_BACKDATE_DAYS = 45;

/**
 * Turns the model's raw reply into validated fields. Never throws; anything
 * that isn't grounded in the user's sentence (an amount not written in it,
 * a merchant name not in it, a category not in their list, a future or
 * ancient date) is dropped rather than trusted.
 */
export function normalizeAIParseOutput(
  rawText: string,
  input: { text: string; today: string; categories: CaptureCategory[] }
): AIParseFields | null {
  const parsed = aiParseSchema.safeParse(firstJsonObject(rawText));
  if (!parsed.success) return null;
  const d = parsed.data;

  const amount = toCents(d.amount ?? null);
  const merchantRaw = clean(d.merchant, 120);
  const merchantKey = merchantRaw ? normalizeMerchant(merchantRaw) : "";
  const merchant = merchantKey.length >= 2 && normalizeMerchant(input.text).includes(merchantKey) ? merchantRaw : null;

  const type = d.type ?? null;
  const categoryName = clean(d.category, 80)?.toLowerCase() ?? null;
  const category = categoryName
    ? input.categories.find(
        (c) =>
          (c.name_en.toLowerCase() === categoryName || c.name_th.toLowerCase() === categoryName) &&
          (!type || c.type === type || c.type === "both")
      ) ?? null
    : null;

  const dateRaw = clean(d.date, 10);
  const date =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) && !Number.isNaN(Date.parse(`${dateRaw}T00:00:00Z`))
      ? (() => {
          const back = daysBetween(dateRaw, input.today);
          return back >= 0 && back <= MAX_BACKDATE_DAYS ? dateRaw : null;
        })()
      : null;

  return {
    type,
    amountCents: amount !== null && amountsInText(input.text).has(amount) ? amount : null,
    merchant,
    categoryId: category?.id ?? null,
    payment: clean(d.payment, 60),
    date,
    description: clean(d.description, 120),
    confidence: d.confidence,
  };
}

// ---------------------------------------------------------------------------
// merge (client)
// ---------------------------------------------------------------------------

const RANK: Record<CaptureConfidence, number> = { low: 0, medium: 1, high: 2 };
const cap = (c: CaptureConfidence, max: CaptureConfidence) => (RANK[c] > RANK[max] ? max : c);

/**
 * Combines the rule result with a validated AI reading. Rules keep what
 * they matched explicitly (an account named in the text); the user's
 * learned merchant → category preference still beats the model; and the
 * result is never more confident than its weakest essential field.
 */
export function mergeAIParse(text: string, local: ParsedCapture, ai: AIParseFields, ctx: ParseContext): ParsedCapture {
  const type = ai.type ?? local.type;
  const amountCents = ai.amountCents ?? local.amountCents;
  const merchant = ai.merchant ?? local.merchant;
  const description = ai.description ?? local.description;

  const learned = merchant ? suggestCategory(merchant, merchant, type, ctx) : null;
  const category =
    learned?.source === "learned"
      ? learned
      : ai.categoryId
        ? { categoryId: ai.categoryId, source: "ai" as const }
        : type === local.type && local.categorySource !== "fallback"
          ? { categoryId: local.categoryId, source: local.categorySource }
          : suggestCategory(text, merchant, type, ctx);

  let accountId = local.accountId;
  let accountSource = local.accountSource;
  if (local.accountSource !== "matched" && ai.payment) {
    const hit = matchAccount(ai.payment, ctx.accounts);
    if (hit) {
      accountId = hit.accountId;
      accountSource = "matched";
    }
  }

  const missing: ParsedCapture["missing"] = [];
  if (!amountCents) missing.push("amount");
  if (!category.categoryId || category.source === "fallback") missing.push("category");
  if (!accountId) missing.push("account");

  let confidence: CaptureConfidence = ai.confidence;
  if (!amountCents || !accountId) confidence = "low";
  else if (!category.categoryId || category.source === "fallback") confidence = cap(confidence, "medium");

  return {
    type,
    amountCents,
    categoryId: category.categoryId,
    categorySource: category.source,
    accountId,
    accountSource,
    merchant,
    description,
    date: ai.date ?? local.date,
    confidence,
    missing,
  };
}
