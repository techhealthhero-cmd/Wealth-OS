import { hasExplicitIncomeMarker, hasForeignCurrency, maskCaptureParameters, emergencyAccountCandidates, extractAmountCandidates, extractCaptureDate, findKnownMerchant, matchAccount, normalizeText, type ParsedCapture, type ParseContext } from "./transaction-parser";
import { findSpokenDateMention, isValidCaptureDate } from "./capture-date";
import { parseSubscriptionIntent } from "./subscription-intent";

/** Stable API codes; array order is also the single-question priority. */
export const REASON_PRIORITY = ["foreign_currency", "emergency_account_unresolved", "conflicting_amounts", "missing_amount", "invalid_date", "unresolved_date", "default_account_guess", "subscription_account_unresolved", "subscription_false_positive_risk", "ambiguous_direction", "duplicate_uncertain"] as const;
export type ReasonCode = typeof REASON_PRIORITY[number];
export type ConfidenceField = "amount" | "direction" | "date" | "account" | "category" | "subscription" | "duplicate";
export interface FieldEvidence<T> { value: T; reliable: boolean; source: string; candidates: T[] }
export interface ConfidenceContext extends ParseContext {
  text: string;
  /** Both are required: first-active-account order is never user consent. */
  defaultAccountEstablishedByUser?: boolean;
  defaultAccountId?: string | null;
  duplicateUncertain?: boolean;
}
const QUESTION: Record<ReasonCode, { field: ConfidenceField; promptTh: string }> = {
  foreign_currency: { field: "amount", promptTh: "ช่วยยืนยันยอดเป็นเงินบาทให้หน่อยได้ไหม?" },
  emergency_account_unresolved: { field: "account", promptTh: "ใช้เงินฉุกเฉินจากบัญชีไหน?" },
  conflicting_amounts: { field: "amount", promptTh: "รายการนี้เป็นเงินกี่บาท?" },
  missing_amount: { field: "amount", promptTh: "รายการนี้เป็นเงินกี่บาท?" },
  invalid_date: { field: "date", promptTh: "รายการนี้เกิดขึ้นวันที่เท่าไร?" },
  unresolved_date: { field: "date", promptTh: "รายการนี้เกิดขึ้นวันที่เท่าไร?" },
  default_account_guess: { field: "account", promptTh: "รายการนี้ใช้บัญชีไหน?" },
  subscription_account_unresolved: { field: "account", promptTh: "ค่าสมาชิกนี้จ่ายจากบัญชีไหน?" },
  subscription_false_positive_risk: { field: "subscription", promptTh: "ต้องการบันทึกเป็นสมาชิกแบบต่ออายุไหม?" },
  ambiguous_direction: { field: "direction", promptTh: "รายการนี้เป็นเงินเข้าหรือเงินออก?" },
  duplicate_uncertain: { field: "duplicate", promptTh: "รายการนี้เป็นรายการใหม่ใช่ไหม?" },
};
const evidence = <T>(value: T, reliable: boolean, source: string, candidates: T[] = [value]): FieldEvidence<T> => ({ value, reliable, source, candidates });

/** Pure, conservative eligibility only. Does not save or alter the legacy parser. */
export function evaluateCaptureConfidence(parsed: ParsedCapture, context: ConfidenceContext) {
  const text = normalizeText(context.text).toLowerCase();
  const reasons = new Set<ReasonCode>();
  if (hasForeignCurrency(text)) reasons.add("foreign_currency");
  let working = maskCaptureParameters(text);
  // Remove every named date, retaining invalid-date evidence rather than its today fallback.
  let mention = findSpokenDateMention(working, context.today);
  let invalidDate = false;
  const namedDates: string[] = [];
  while (mention) {
    if (!mention.date) invalidDate = true;
    else namedDates.push(mention.date);
    working = working.slice(0, mention.start) + " ".repeat(mention.end - mention.start) + working.slice(mention.end);
    mention = findSpokenDateMention(working, context.today);
  }
  const merchant = findKnownMerchant(working);
  if (merchant) working = working.slice(0, merchant.span.start) + " " + working.slice(merchant.span.end);
  const account = matchAccount(working, context.accounts);
  if (account?.span) working = working.slice(0, account.span.start) + " " + working.slice(account.span.end);
  const candidates = parsed.unit ? [parsed.amountCents] : extractAmountCandidates(working).map(c => c.cents);
  const amountValues = [...new Set(candidates)];
  if (!Number.isSafeInteger(parsed.amountCents) || parsed.amountCents! <= 0) reasons.add("missing_amount");
  if (amountValues.length > 1 || (amountValues.length === 1 && amountValues[0] !== parsed.amountCents)) reasons.add("conflicting_amounts");
  if (invalidDate || !isValidCaptureDate(parsed.date, context.today)) reasons.add("invalid_date");
  const relative = extractCaptureDate(text, context.today);
  const relativeKinds = [/เมื่อวานซืน/, /เมื่อวาน(?!ซืน)|\byesterday\b/, /วันนี้|\btoday\b/].filter(r => r.test(text)).length;
  if (/พรุ่งนี้|มะรืน|อาทิตย์ก่อน|สัปดาห์ก่อน|วันก่อน|เดือนก่อน|tomorrow|last week|\d{1,4}[/-]\d{1,2}/i.test(text)
    || new Set(namedDates).size > 1 || relativeKinds > 1 || parsed.date !== relative.date) reasons.add("unresolved_date");
  const active = context.accounts.filter(a => !a.is_archived);
  const established = context.defaultAccountEstablishedByUser === true && context.defaultAccountId === parsed.accountId;
  const accountCandidates = active.filter(a => matchAccount(text, [a]) !== null).map(a => a.id);
  if ((!parsed.isEmergencyFundDraw && accountCandidates.length > 1) || !active.some(a => a.id === parsed.accountId) || (parsed.accountSource === "default" && !established) || parsed.suggestedAccountId) reasons.add("default_account_guess");
  if (parsed.emergencyFundAccountMissing || (parsed.isEmergencyFundDraw && emergencyAccountCandidates(context).length > 1 && !active.some(a => a.id === context.emergencyFundAccountId))) reasons.add("emergency_account_unresolved");
  if (parsed.subscriptionAccountMissing) reasons.add("subscription_account_unresolved");
  // Service identity alone is not consent to create a recurring schedule.
  const recurring = /สมัครสมาชิก|ต่อสมาชิก|ต่ออายุ|สมัคร(?!\s*(?:เรียน|งาน|สอบ|แข่งขัน))|รายเดือน|รายปี|เดือนละ|ปีละ|ต่อเดือน|ต่อปี|\b(?:subscribe|subscription|monthly|yearly|annual|annually)\b/i.test(text);
  if (parsed.type === "expense" && (parsed.subscription || parseSubscriptionIntent(text)) && (!recurring || /ไม่(?:ได้|ต้องการ|เอา)?\s*(?:สมัคร|ต่ออายุ)|ครั้งเดียว|เคยสมัคร|ทดลอง|ยกเลิก|not subscribe|one.off|trial/i.test(text))) reasons.add("subscription_false_positive_risk");
  const incoming = hasExplicitIncomeMarker(text) || /รายรับ|เงินเดือน|รับเงิน|ได้เงิน|โอนมา|คืนเงิน|freelance|salary|^\+/.test(text);
  const outgoing = /ซื้อ|จ่าย|กิน|ข้าว|กาแฟ|ค่า|โอนให้|โอนเงินให้|เบอร์เกอร์|น้ำ|ขนม|แท็กซี่|รถเมล์|เติม|อาหาร|ช้อป|spent|paid/.test(text);
  const mixedDirection = incoming && /จ่าย|ซื้อ|โอนให้|โอนเงินให้/.test(text.replace(/ลูกค้าจ่าย|หัก\s*ณ\s*ที่จ่าย/g, ""));
  const hypothetical = /ไม่ได้จ่าย|ยังไม่จ่าย|ไม่ได้ซื้อ|ยังไม่ได้ซื้อ|สมมติ|ถ้าซื้อ|ถ้าจ่าย|จะจ่าย/.test(text);
  if (mixedDirection || hypothetical || (incoming && parsed.type !== "income") || (!incoming && !outgoing && !parsed.unit && !recurring) || /เงินเข้า.*เงินออก|รับหรือจ่าย|โอนระหว่าง|ย้ายเงิน|โอนจาก.*ไป|ยืม|ให้ยืม/.test(text) || parsed.cancelIntent || parsed.smart) reasons.add("ambiguous_direction");
  if (context.duplicateUncertain) reasons.add("duplicate_uncertain");
  const ordered = REASON_PRIORITY.filter(r => reasons.has(r));
  const fields = {
    amount: evidence(parsed.amountCents, !reasons.has("foreign_currency") && !reasons.has("missing_amount") && !reasons.has("conflicting_amounts"), parsed.unit ? "unit" : "text", amountValues),
    direction: evidence(parsed.type, !reasons.has("ambiguous_direction"), "rules", reasons.has("ambiguous_direction") ? ["expense", "income"] as const : [parsed.type]),
    date: evidence(parsed.date, !reasons.has("invalid_date") && !reasons.has("unresolved_date"), relative.named ? "named" : "today", [...new Set([parsed.date, ...namedDates])]),
    account: evidence(parsed.accountId, !ordered.some(r => ["default_account_guess", "emergency_account_unresolved", "subscription_account_unresolved"].includes(r)), parsed.accountSource ?? "missing", active.map(a => a.id)),
    category: evidence(parsed.categoryId, parsed.categorySource === "keyword" || parsed.categorySource === "learned", parsed.categorySource ?? "missing"),
  };
  return { autoSave: ordered.length === 0, level: (ordered.length === 0 ? "high" : ordered.length === 1 ? "medium" : "low") as "high" | "medium" | "low", reasons: ordered, fields, question: ordered.length ? { ...QUESTION[ordered[0]], reason: ordered[0] } : null };
}
export type CaptureConfidenceResult = ReturnType<typeof evaluateCaptureConfidence>;
