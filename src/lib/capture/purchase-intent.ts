import { ASSET_GROUPS, classifyAssetName, type AssetType } from "@/lib/financial/asset-taxonomy";

export const ALWAYS_ASSET_THRESHOLD_CENTS = 100_000;
export const DURABLE_ASSET_THRESHOLD_CENTS = 1_500_000;
export const DURABLE_ASK_THRESHOLD_CENTS = 300_000;
export type RatePeriod = "month" | "year";
export interface PaymentRow { number: number; dueDate: string; paymentCents: number; interestCents: number; principalCents: number; balanceCents: number }
export interface PaymentPlan {
  principalCents: number; monthlyRate: number; annualRatePct: number; termMonths: number;
  monthlyPaymentCents: number; interestOnlyMonthlyCents: number; totalInterestCents: number;
  totalPaidCents: number; firstDueDate: string; lastDueDate: string; schedule: PaymentRow[];
}
export interface SmartCaptureIntent {
  kind: "asset_cash" | "asset_installment" | "loan";
  assetName: string; assetType: AssetType; group: string; subcategory: string;
  assetDecision: "asset" | "ask"; priceCents: number; downPaymentCents: number; principalCents: number;
  amountCents: number; ratePct: number; ratePeriod: RatePeriod | null;
  ratePeriodAssumed: boolean; ratePeriodNeedsConfirm: boolean; suggestedRatePeriod: RatePeriod;
  rateMissing: boolean; termMonths: number; termAssumed: boolean; statedMonthlyCents: number | null;
  liabilityType: "mortgage" | "car_loan" | "personal_loan" | "informal_debt" | "student_loan";
  aboveLegalCap: boolean; plan: PaymentPlan | null;
}
const halfUp = (n: number) => Math.floor(n + .5 + Number.EPSILON * Math.abs(n));
/** Monthly rate is a decimal (0.005 = 6% annual / 12). Returns integer satang. */
export function calculatePMT(principalCents: number, monthlyRate: number, termMonths: number): number {
  if (!Number.isSafeInteger(principalCents) || principalCents < 0 || !Number.isFinite(monthlyRate) || monthlyRate < 0 || !Number.isInteger(termMonths) || termMonths < 1 || termMonths > 1200) throw new RangeError("Invalid loan plan");
  return halfUp(monthlyRate === 0 ? principalCents / termMonths : principalCents * monthlyRate / -Math.expm1(-termMonths * Math.log1p(monthlyRate)));
}
/** Anchor each due date to the original purchase day, so Jan 31 → Feb 28 → Mar 31. */
export function monthlyDueDate(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
export function buildPaymentPlan(input: { principalCents: number; ratePct: number; ratePeriod: RatePeriod; termMonths: number; captureDate: string; statedMonthlyCents?: number | null; fixedTerm?: boolean }): PaymentPlan {
  const { principalCents, ratePct, ratePeriod, termMonths, captureDate } = input;
  if (!Number.isFinite(ratePct) || ratePct < 0) throw new RangeError("Invalid rate");
  // "เดือนละ 2,500 24 งวด" with no rate said: the contract is n equal stated payments
  // (hire-purchase style). Interest is implied = stated × n − principal (never negative);
  // it is spread evenly, the last row absorbs rounding so the balance ends at 0.
  if (input.fixedTerm && ratePct === 0 && input.statedMonthlyCents && input.statedMonthlyCents * termMonths >= principalCents) {
    const stated = input.statedMonthlyCents;
    calculatePMT(principalCents, 0, termMonths); // same range validation
    const impliedInterest = stated * termMonths - principalCents;
    const perRowInterest = Math.floor(impliedInterest / termMonths);
    let balance = principalCents;
    const schedule: PaymentRow[] = [];
    for (let i = 1; i <= termMonths; i++) {
      const last = i === termMonths;
      const interestCents = last ? impliedInterest - perRowInterest * (termMonths - 1) : perRowInterest;
      const principalPaid = last ? balance : stated - interestCents;
      balance -= principalPaid;
      schedule.push({ number: i, dueDate: monthlyDueDate(captureDate, i), paymentCents: principalPaid + interestCents, interestCents, principalCents: principalPaid, balanceCents: balance });
    }
    const totalPaidCents = schedule.reduce((sum, row) => sum + row.paymentCents, 0);
    return { principalCents, monthlyRate: 0, annualRatePct: 0, termMonths, monthlyPaymentCents: stated, interestOnlyMonthlyCents: 0, totalPaidCents, totalInterestCents: totalPaidCents - principalCents, firstDueDate: schedule[0].dueDate, lastDueDate: schedule.at(-1)!.dueDate, schedule };
  }
  const monthlyRate = ratePct / (ratePeriod === "year" ? 1200 : 100);
  const calculated = calculatePMT(principalCents, monthlyRate, termMonths);
  const monthlyPaymentCents = input.statedMonthlyCents ?? calculated;
  if (!Number.isSafeInteger(monthlyPaymentCents) || monthlyPaymentCents < 0) throw new RangeError("Invalid payment");
  let balance = principalCents;
  const schedule: PaymentRow[] = [];
  for (let i = 1; i <= termMonths; i++) {
    const interestCents = halfUp(balance * monthlyRate);
    const paymentCents = i === termMonths ? balance + interestCents : Math.min(monthlyPaymentCents, balance + interestCents);
    const principalPaid = paymentCents - interestCents;
    balance -= principalPaid;
    if (!Number.isSafeInteger(balance) || !Number.isSafeInteger(paymentCents)) throw new RangeError("Plan too large");
    schedule.push({ number: i, dueDate: monthlyDueDate(captureDate, i), paymentCents, interestCents, principalCents: principalPaid, balanceCents: balance });
    if (balance === 0) break; // A stated payment can pay off early; never schedule later overpayments.
  }
  const totalPaidCents = schedule.reduce((sum, row) => sum + row.paymentCents, 0);
  return { principalCents, monthlyRate, annualRatePct: ratePct * (ratePeriod === "month" ? 12 : 1), termMonths: schedule.length, monthlyPaymentCents, interestOnlyMonthlyCents: halfUp(principalCents * monthlyRate), totalPaidCents, totalInterestCents: totalPaidCents - principalCents, firstDueDate: schedule[0].dueDate, lastDueDate: schedule.at(-1)!.dueDate, schedule };
}
/** No schedule for a cash purchase, an unconfirmed rate period, or an interest-free loan with no
 * term said ("ยืมเงินแม่ 5,000"): that debt is recorded without inventing monthly payments. */
export function smartCaptureHasPlan(kind: SmartCaptureIntent["kind"], ratePct: number, termAssumed: boolean, ratePeriod: RatePeriod | null): boolean {
  if (kind === "asset_cash" || ratePeriod === null) return false;
  return !(kind === "loan" && ratePct === 0 && termAssumed);
}
/** Rebuild after a user confirms monthly/yearly; assumed terms follow that choice. */
export function resolveSmartCapture(intent: SmartCaptureIntent, date: string, period?: RatePeriod): SmartCaptureIntent {
  const ratePeriod = period ?? intent.ratePeriod;
  const termMonths = intent.termAssumed ? (ratePeriod === "month" && intent.ratePct > 0 ? 6 : 12) : intent.termMonths;
  const plan = smartCaptureHasPlan(intent.kind, intent.ratePct, intent.termAssumed, ratePeriod) ? buildPaymentPlan({ principalCents: intent.principalCents, ratePct: intent.ratePct, ratePeriod: ratePeriod!, termMonths, captureDate: date, statedMonthlyCents: intent.statedMonthlyCents, fixedTerm: !intent.termAssumed }) : null;
  return { ...intent, ratePeriod, ratePeriodNeedsConfirm: intent.ratePeriodNeedsConfirm && period === undefined, termMonths, plan, aboveLegalCap: (plan?.annualRatePct ?? 0) > 15 };
}
const NUM = "[0-9][0-9,]*(?:\\.[0-9]+)?(?:\\s*(?:ล้าน|หมื่น|พัน|[kK]))?";
export function parseSmartMoney(text: string): number {
  const clean = text.replace(/,/g, "").trim();
  const multiplier = /ล้าน/.test(clean) ? 1e6 : /หมื่น/.test(clean) ? 1e4 : /พัน|k/i.test(clean) ? 1e3 : 1;
  return halfUp(parseFloat(clean) * multiplier * 100);
}
const EXCLUDED = /ซื้อ(?:เสื้อ|กางเกง|รองเท้าทั่วไป|อาหาร|ข้าว|ของกิน|ของชำ|เครื่องสำอาง)|ค่าซ่อม|ซ่อม|ค่าเช่า|เช่า|ล้างรถ|เติมน้ำมัน|ประกัน|ค่างวด|ผ่อน(?:รถ|บ้าน|หนี้)?งวดนี้|ภาษีรถ|ค่าไฟ|ค่าส่ง|อะไหล่เล็ก|เคส|ฟิล์ม|สายชาร์จ|repair|rent|insurance|phone case|screen protector|charging cable/i;
const LENT_OR_REPAYMENT = /ให้.{0,12}(?:ยืม|กู้)|เพื่อนยืม|(?:จ่าย|ชำระ|โปะ|ปิด|คืน)\s*(?:เงิน|ค่า)?\s*(?:กู้|หนี้|ดอก|งวด)|ผ่อน\s*(?:เงิน)?(?:กู้|หนี้)|repay|pay(?:ing)?\s+(?:off|back)|lend|lent/i;
/** Pure detection; caller supplies the capture's local date. No account/category policy here. */
export function parsePurchaseIntent(input: string, captureDate: string): SmartCaptureIntent | null {
  const text = input.replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50));
  if (LENT_OR_REPAYMENT.test(text) || EXCLUDED.test(text)) return null;
  const loan = /กู้|ยืมเงิน|กยศ|borrow|take out.{0,8}loan/i.test(text);
  const purchase = /สั่งซื้อ|ซื้อ|ถอย|ออกรถ|จัด|\bbuy\b|\bbought\b/i.exec(text);
  const objectText = purchase ? `${purchase[0] === "ออกรถ" ? "รถ" : ""}${text.slice(purchase.index + purchase[0].length)}`
    .replace(/^\s*(?:(?:a|an|the|new)\s+)+/i, "").trim().split(/\d|ดาวน์|ผ่อน|จากบัญชี|จ่ายด้วย/)[0].trim() : "";
  const classified = classifyAssetName(loan ? text : objectText);
  const g = ASSET_GROUPS.find((g) => g.key === classified?.group);
  const sub = g?.subcategories.find((p) => p.key === classified?.subcategory);
  if (!loan && (!purchase || !g?.captureTier || !sub)) return null;
  // A location ("ซื้อของเข้าบ้าน") is not the purchased item. Reuse taxonomy
  // keywords to require the object itself, instead of a durable word anywhere.
  if (!loan && !g!.subcategories.some((p) => p.keywords.some((word) => objectText.toLowerCase().startsWith(word)))) return null;
  const beforePlan = text.split(/ดาวน์|ผ่อน|ดอก|เดือนละ|งวดละ|down payment|installment|interest/i)[0];
  // Largest price candidate ignores gold weight, model numbers and counts before the price.
  const prices = [...beforePlan.matchAll(new RegExp(NUM, "g"))].map((m) => parseSmartMoney(m[0]));
  const price = Math.max(0, ...prices);
  if (price <= 0 || !Number.isSafeInteger(price) || price >= 1e15) return null;
  const installment = !loan && /ผ่อน|installment/i.test(text);
  const always = g?.captureTier === "always" && sub?.key !== "drone" && sub?.key !== "smartwatch";
  if (!loan && !installment && !always && price < DURABLE_ASK_THRESHOLD_CENTS) return null;
  const down = text.match(new RegExp(`(?:ดาวน์|down payment)\\s*(${NUM})`, "i"));
  const downPaymentCents = installment && down ? parseSmartMoney(down[1]) : 0;
  if (downPaymentCents > price) return null;
  const rateHit = text.match(/(?:ดอก(?:เบี้ย)?|interest)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:(ต่อเดือน|ต่อปี|\/เดือน|\/ปี|per month|per year))?/i);
  const ratePct = rateHit ? Number(rateHit[1]) : 0;
  const explicitPeriod: RatePeriod | null = rateHit?.[2] ? /เดือน|month/.test(rateHit[2]) ? "month" : "year" : null;
  const ratePeriod = explicitPeriod ?? (loan && ratePct > 0 ? null : "year");
  const term = text.match(/(\d+)\s*(เดือน|ปี|งวด|months?|years?)/i);
  const termMonths = term ? Number(term[1]) * (/ปี|year/i.test(term[2]) ? 12 : 1) : 12;
  if (termMonths < 1 || termMonths > 1200) return null;
  const monthly = text.match(new RegExp(`(?:เดือนละ|งวดละ)\\s*(${NUM})`, "i"));
  const informal = /นอกระบบ|ยืม|แม่|พ่อ|borrow/i.test(text);
  const principalCents = loan ? price : price - downPaymentCents;
  const intent: SmartCaptureIntent = {
    kind: loan ? "loan" : installment ? "asset_installment" : "asset_cash",
    assetName: loan ? /กยศ/.test(text) ? "กยศ" : informal ? "หนี้นอกระบบ" : "เงินกู้" : sub!.labelTh,
    assetType: g?.assetType ?? "other", group: g?.key ?? "custom", subcategory: sub?.key ?? "loan",
    assetDecision: price >= (always ? ALWAYS_ASSET_THRESHOLD_CENTS : DURABLE_ASSET_THRESHOLD_CENTS) ? "asset" : "ask",
    priceCents: price, downPaymentCents, principalCents,
    amountCents: loan || !installment ? price : downPaymentCents,
    ratePct, ratePeriod, ratePeriodAssumed: installment && !!rateHit && !explicitPeriod,
    ratePeriodNeedsConfirm: loan && ratePct > 0 && !explicitPeriod,
    suggestedRatePeriod: informal ? "month" : "year", rateMissing: !rateHit,
    termMonths, termAssumed: !term, statedMonthlyCents: monthly ? parseSmartMoney(monthly[1]) : null,
    liabilityType: loan ? /กยศ/.test(text) ? "student_loan" : informal ? "informal_debt" : "personal_loan" : g?.assetType === "property" ? "mortgage" : g?.assetType === "vehicle" ? "car_loan" : "personal_loan",
    aboveLegalCap: false, plan: null,
  };
  return resolveSmartCapture(intent, captureDate);
}

/** Preserve source offsets while hiding plan parameters from recap's amount splitter.
 * Only purchase/borrowing clauses opt in; ordinary daily expenses keep their splitter.
 * Principal/price remains visible, while down payment, term, rate and stated payment
 * stay attached to it (including when followed by another ordinary recap item).
 */
export function maskPurchasePlanNumbers(text: string): string {
  if (!/ซื้อ|ถอย|ออกรถ|สั่งซื้อ|จัด|กู้|ยืมเงิน|กยศ|\bbuy\b|\bbought\b|\bborrow/i.test(text)) return text;
  let masked = text;
  for (const re of [
    new RegExp(`(?:ดาวน์|down payment|เดือนละ|งวดละ)\\s*${NUM}`, "gi"),
    /\d+(?:\.\d+)?\s*%/g,
    /\d+\s*(?:เดือน|ปี|งวด|months?\b|years?\b)/gi,
    /(?:ทอง(?:คำ)?)\s*\d+(?:\.\d+)?\s*บาท(?=\s*[\d,]+)/g,
  ]) masked = masked.replace(re, (m) => m.replace(/[\d,]/g, "#"));
  return masked;
}

/** Extra recap boundaries keep plan metadata apart from the next normal expense. */
export function purchasePlanParameterEnds(text: string): number[] {
  if (!/ซื้อ|ถอย|ออกรถ|สั่งซื้อ|จัด|กู้|ยืมเงิน|กยศ|\bbuy\b|\bbought\b|\bborrow/i.test(text)) return [];
  const pattern = new RegExp(`(?:ดาวน์|down payment|เดือนละ|งวดละ)\\s*${NUM}|\\d+(?:\\.\\d+)?\\s*%\\s*(?:ต่อเดือน|ต่อปี|/เดือน|/ปี)?|\\d+\\s*(?:เดือน|ปี|งวด|months?\\b|years?\\b)`, "gi");
  return [...text.matchAll(pattern)].map((m) => m.index! + m[0].length);
}
