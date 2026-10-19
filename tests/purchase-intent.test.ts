import { describe, it, expect } from "vitest";
import { parsePurchaseIntent, calculatePMT, buildPaymentPlan, resolveSmartCapture, monthlyDueDate } from "@/lib/capture/purchase-intent";
import { parseCaptureText, type ParseContext } from "@/lib/capture/transaction-parser";
import { canSaveDraft, buildCaptureSaveInput, type CaptureDraft } from "@/lib/capture/draft";
const date = "2026-10-19";
const parse = (s: string) => parsePurchaseIntent(s, date);
const ctx: ParseContext = { today: date, accounts: [{ id: "cash", name: "เงินสด", account_type: "cash", institution: null, is_archived: false }], categories: [], merchantPreferences: [] };
describe("approved amortization", () => {
  it.each([[180000000, .06 / 12, 360, 1079191], [2000000, .20, 6, 601411], [2000000, .20 / 12, 12, 185269]])("PMT %s at %s over %s", (p, r, n, expected) => expect(calculatePMT(p, r, n)).toBe(expected));
  it.each([[180000000, 6, "year", 360], [2000000, 20, "month", 6], [2000000, 20, "year", 12], [100, 0, "year", 3]] as const)("ends exactly at zero", (principalCents, ratePct, ratePeriod, termMonths) => {
    const plan = buildPaymentPlan({ principalCents, ratePct, ratePeriod, termMonths, captureDate: date });
    expect(plan.schedule.at(-1)?.balanceCents).toBe(0);
    expect(plan.schedule.reduce((sum, p) => sum + p.principalCents, 0)).toBe(principalCents);
    expect(plan.totalInterestCents).toBe(plan.totalPaidCents - principalCents);
    expect(plan.schedule.every((p) => Number.isInteger(p.paymentCents) && Number.isInteger(p.interestCents))).toBe(true);
  });
  it("rounds zero rate half up and adjusts final satang", () => {
    expect(calculatePMT(101, 0, 2)).toBe(51);
    expect(buildPaymentPlan({ principalCents: 101, ratePct: 0, ratePeriod: "year", termMonths: 2, captureDate: date }).schedule.map((p) => p.paymentCents)).toEqual([51, 50]);
  });
  it("clamps to month end without losing the original anchor", () => {
    expect(monthlyDueDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(monthlyDueDate("2026-01-31", 2)).toBe("2026-03-31");
    expect(monthlyDueDate("2024-01-31", 1)).toBe("2024-02-29");
  });
});
describe("smart capture", () => {
  it.each([
    ["ซื้อคอมใหม่ 20,000 เงินสด", "computer", 2000000, "asset"], ["ซื้อหูฟัง 3,500", "headphones", 350000, "ask"], ["ซื้อรถเงินสด 650,000", "car", 65000000, "asset"], ["ถอยไอโฟน 45,000", "phone", 4500000, "asset"], ["ซื้อทอง 1 บาท 40,000", "gold", 4000000, "asset"], ["bought MacBook 40k", "laptop", 4000000, "asset"], ["ซื้อคอม ๒๐,๐๐๐", "computer", 2000000, "asset"], ["ซื้อบ้าน 2 ล้าน", "house", 200000000, "asset"], ["จัดคอม 2 หมื่น", "computer", 2000000, "asset"], ["สั่งซื้อหูฟัง 3พัน", "headphones", 300000, "ask"], ["ซื้อทอง 999", "gold", 99900, "ask"], ["ซื้อคอม 15000", "computer", 1500000, "asset"],
  ])("%s", (s, subcategory, amountCents, assetDecision) => expect(parse(s)).toMatchObject({ kind: "asset_cash", subcategory, amountCents, assetDecision }));
  it.each(["ค่าซ่อมคอม 2,000", "ผ่อนรถงวดนี้ 8,000", "กินข้าว 60", "ซื้อเสื้อ 6,000", "ให้เพื่อนยืม 500", "เติมน้ำมันรถ 1,000", "ซื้อเคสไอโฟน 390", "ซื้อคอม 2999", "คอม 20000", "ซื้อฟิล์มไอโฟน 4000", "ซื้อสายชาร์จ 4000", "เช่ารถ 50000", "จ่ายหนี้กู้ 10000", "คืนเงินกู้ 5000", "ให้กู้เงิน 20000", "เพื่อนยืมเงิน 5000", "ซื้อประกันรถ 20000", "ซื้อของกิน 20000", "ซื้อเครื่องสำอาง 20000"])("keeps ordinary expense/lending: %s", (s) => expect(parse(s)).toBeNull());
  it("house plan and money movement are distinct", () => {
    const s = parse("ซื้อบ้าน 2,000,000 ดาวน์ 200,000 ผ่อน 30 ปี ดอก 6%")!;
    expect(s).toMatchObject({ kind: "asset_installment", priceCents: 200000000, amountCents: 20000000, principalCents: 180000000, ratePeriod: "year", ratePeriodAssumed: true, liabilityType: "mortgage", termMonths: 360 });
    expect(s.plan).toMatchObject({ monthlyPaymentCents: 1079191, firstDueDate: "2026-11-19", lastDueDate: "2056-10-19" });
    expect(parseCaptureText("ซื้อบ้าน 2,000,000 ดาวน์ 200,000 ผ่อน 30 ปี ดอก 6%", ctx).amountCents).toBe(20000000);
  });
  it("zero down, zero interest phone needs no transaction amount", () => {
    const s = parse("ซื้อไอโฟน 40,000 ผ่อน 0% 10 เดือน")!;
    expect(s).toMatchObject({ amountCents: 0, rateMissing: false });
    expect(s.plan?.monthlyPaymentCents).toBe(400000);
    const draft: CaptureDraft = { ...parseCaptureText("ซื้อไอโฟน 40,000 ผ่อน 0% 10 เดือน", ctx), source: "quick_text", categoryConfirmedByUser: false };
    expect(canSaveDraft(draft)).toBe(true);
    expect(buildCaptureSaveInput(draft, "request")?.amountCents).toBe(0);
  });
  it("uses stated payments and missing-rate estimate", () => {
    const s = parse("ซื้อมอไซค์ 60,000 ดาวน์ 5,000 ผ่อนเดือนละ 2,500 24 งวด")!;
    expect(s).toMatchObject({ amountCents: 500000, principalCents: 5500000, termMonths: 24, rateMissing: true, liabilityType: "car_loan" });
    expect(s.plan?.monthlyPaymentCents).toBe(250000);
    expect(s.plan?.schedule.at(-1)?.balanceCents).toBe(0);
  });
  it("asks missing loan period; choice rebuilds the assumed term", () => {
    const s = parse("กู้นอกระบบ 20,000 ดอก 20%")!;
    expect(s).toMatchObject({ ratePeriod: null, ratePeriodNeedsConfirm: true, suggestedRatePeriod: "month", plan: null });
    const monthly = resolveSmartCapture(s, date, "month");
    expect(monthly).toMatchObject({ termMonths: 6, aboveLegalCap: true, ratePeriodNeedsConfirm: false });
    expect(monthly.plan).toMatchObject({ monthlyPaymentCents: 601411, annualRatePct: 240, interestOnlyMonthlyCents: 400000 });
    expect(resolveSmartCapture(s, date, "year").plan?.monthlyPaymentCents).toBe(185269);
  });
  it("bank and student loans and interest-free family borrowing", () => {
    expect(parse("กู้เงินธนาคาร 100,000 ดอก 8% ต่อปี 24 เดือน")).toMatchObject({ kind: "loan", ratePeriod: "year", termMonths: 24, liabilityType: "personal_loan" });
    expect(parse("ยืมเงินแม่ 5,000")).toMatchObject({ ratePct: 0, termMonths: 12, liabilityType: "informal_debt" });
    expect(parse("กยศ 50000")).toMatchObject({ liabilityType: "student_loan" });
    expect(parseCaptureText("กู้นอกระบบ 20,000 ดอก 20%", ctx)).toMatchObject({ type: "income", amountCents: 2000000 });
  });
});

describe("capture integration boundaries", () => {
  it("keeps installment parameters together in voice/recap, with later expenses separate", async () => {
    const { parseRecap } = await import("@/lib/capture/recap");
    const rows = parseRecap("ซื้อบ้าน 2,000,000 ดาวน์ 200,000 ผ่อน 30 ปี ดอก 6% กินข้าว 60", ctx);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ amountCents: 20000000, smart: { kind: "asset_installment", termMonths: 360 } });
    expect(rows[1]).toMatchObject({ amountCents: 6000 });
  });
  it.each(["กู้นอกระบบ 20,000 ดอก 20%", "ซื้อไอโฟน 40,000 ผ่อน 0% 10 เดือน", "ซื้อมอไซค์ 60,000 ดาวน์ 5,000 ผ่อนเดือนละ 2,500 24 งวด", "ซื้อทอง 1 บาท 40,000"])("voice preserves one intent: %s", async (text) => {
    const { parseRecap } = await import("@/lib/capture/recap");
    const rows = parseRecap(text, ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0].smart).toEqual(parse(text));
  });
  it("AI cannot overwrite the down payment or borrowing type", async () => {
    const { mergeAIParse, needsAIAssist } = await import("@/lib/capture/ai-fallback");
    const text = "ซื้อบ้าน 2000000 ดาวน์ 200000 ผ่อน 30 ปี ดอก 6%";
    const local = parseCaptureText(text, ctx);
    expect(needsAIAssist(text, local)).toBe(false);
    expect(mergeAIParse(text, local, { amountCents: 200000000, type: "income", confidence: "high" } as Parameters<typeof mergeAIParse>[2], ctx)).toBe(local);
  });
});

describe("purchase objects and independent repayments", () => {
  it.each(["เมื่อวานซื้อของเข้าบ้าน 860 ใช้บัตรเครดิต", "ซื้อของที่ตลาดนัดหน้าหมู่บ้านแถวบ้านยาย 350", "ซื้ออาหารวัว 5000", "ซื้อเสื้อ Gucci 6000"])("does not infer an asset from a location or consumable: %s", (s) => expect(parse(s)).toBeNull());
  it("does not absorb an existing repayment into a preceding purchase", async () => {
    const { parseRecap } = await import("@/lib/capture/recap");
    const rows = parseRecap("ซื้อคอม 20000; ผ่อนรถงวดนี้ 8000", ctx);
    expect(rows).toHaveLength(2);
    expect(rows[0].smart?.kind).toBe("asset_cash");
    expect(rows[1].smart).toBeUndefined();
    expect(rows[1].amountCents).toBe(800000);
  });
});

it("ends a stated-payment schedule at early payoff, preventing later calendar overpayments", () => {
  const plan = buildPaymentPlan({ principalCents: 5500000, ratePct: 0, ratePeriod: "year", termMonths: 24, statedMonthlyCents: 250000, captureDate: date });
  expect(plan.schedule).toHaveLength(22);
  expect(plan.termMonths).toBe(22);
  expect(plan.lastDueDate).toBe("2028-08-19");
  expect(plan.totalPaidCents).toBe(5500000);
});

describe("smart capture review fixes", () => {
  it.each(["จ่ายเงินกู้ 3,000", "ชำระเงินกู้ 2,000", "โปะหนี้ 5,000", "จ่ายดอกเงินกู้ 4,000", "ผ่อนเงินกู้ 3,000", "ปิดหนี้ 10,000", "คืนเงินที่ยืมแม่ 1,000", "จ่ายค่างวดรถ 8,000"])("repayment %s is not a new loan", (text) => {
    expect(parsePurchaseIntent(text, date)).toBeNull();
  });
  it("keeps installment purchases that say งวดละ", () => {
    expect(parsePurchaseIntent("ซื้อไอโฟน 40,000 ผ่อนงวดละ 4,000 10 งวด", date)?.kind).toBe("asset_installment");
  });
  it("honours a stated payment for the full stated term (implied flat interest)", () => {
    const s = parsePurchaseIntent("ซื้อมอไซค์ 60,000 ดาวน์ 5,000 ผ่อนเดือนละ 2,500 24 งวด", date)!;
    expect(s.plan).toMatchObject({ termMonths: 24, monthlyPaymentCents: 250000, totalPaidCents: 6000000, totalInterestCents: 500000 });
    expect(s.plan?.schedule.at(-1)?.balanceCents).toBe(0);
    expect(s.plan?.schedule.every((r) => r.paymentCents === 250000)).toBe(true);
  });
  it("records an interest-free family loan with no term without inventing a schedule", () => {
    const s = parsePurchaseIntent("ยืมเงินแม่ 5,000", date)!;
    expect(s.kind).toBe("loan");
    expect(s.liabilityType).toBe("informal_debt");
    expect(s.plan).toBeNull();
  });
});
