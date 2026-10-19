import { describe, expect, it } from "vitest";
import fixture from "./fixtures/nlp/capture-corpus.v1.json";
import { evaluateCaptureConfidence, REASON_PRIORITY, type ConfidenceContext } from "@/lib/capture/confidence";
import { parseCaptureText, type ParseContext } from "@/lib/capture/transaction-parser";
import { createConfidenceDraft } from "@/lib/capture/draft";
import { evaluateCorpus, type CaptureCorpus } from "@/lib/capture/evaluation";

const base = fixture.context as ParseContext;
function check(text: string, overrides: Partial<ConfidenceContext> = {}) {
  const context = { ...base, ...overrides, text };
  const parsed = parseCaptureText(text, context);
  return { parsed, context, gate: evaluateCaptureConfidence(parsed, context) };
}
describe("capture confidence", () => {
  it("automatically accepts clear financial fields even without a category", () => {
    const { gate } = check("จ่ายของ 70 บาท cash", { categories: [] });
    expect(gate.autoSave).toBe(true);
    expect(gate.fields.category.reliable).toBe(false);
    expect(gate.question).toBeNull();
  });
  it("requires an explicitly established default with the same account id", () => {
    expect(check("จ่ายข้าว 70 บาท").gate.reasons).toContain("default_account_guess");
    expect(check("จ่ายข้าว 70 บาท", { defaultAccountEstablishedByUser: true }).gate.autoSave).toBe(false);
    expect(check("จ่ายข้าว 70 บาท", { defaultAccountEstablishedByUser: true, defaultAccountId: "bank" }).gate.autoSave).toBe(false);
    expect(check("จ่ายข้าว 70 บาท", { defaultAccountEstablishedByUser: true, defaultAccountId: "cash" }).gate.autoSave).toBe(true);
  });
  it("retains competing amounts and asks only one question", () => {
    const { gate } = check("31 ก.พ. จ่ายข้าว 70 บาท หรือ 90 บาท");
    expect(gate.fields.amount.candidates).toEqual([7000, 9000]);
    expect(gate.reasons).toEqual(["conflicting_amounts", "invalid_date", "default_account_guess"]);
    expect(gate.question?.field).toBe("amount");
  });
  it("prioritizes unresolved emergency accounts over every other uncertainty", () => {
    const { parsed, context, gate } = check("31 ก.พ. ใช้เงินฉุกเฉินจ่ายข้าว 70 บาท หรือ 90 บาท", { accounts: base.accounts.slice(0, 2), emergencyFundAccountId: null });
    expect(gate.question?.reason).toBe("emergency_account_unresolved");
    expect(createConfidenceDraft(parsed, context)).toMatchObject({ isEmergencyFundDraw: true, emergencyFundAccountMissing: true, confidenceGate: gate });
  });
  it("does not accept an invalid date's parser fallback to today", () => {
    const { parsed, gate } = check("31 ก.พ. จ่ายข้าว 70 บาท cash");
    expect(parsed.date).toBe(base.today);
    expect(gate.fields.date.reliable).toBe(false);
    expect(gate.question?.reason).toBe("invalid_date");
  });
  it.each(["พรุ่งนี้", "วันก่อน", "20/10/2026", "เมื่อวาน วันนี้", "8 ตุลา 9 ตุลา"])("blocks unresolved or competing date %s", date => {
    expect(check(`${date} จ่ายข้าว 70 บาท cash`).gate.autoSave).toBe(false);
  });
  it.each(["YouTube", "Netflix", "Spotify"])("requires recurring intent beyond service identity %s", service => {
    expect(check(`จ่ายค่า ${service} 70 บาท cash`).gate.question?.reason).toBe("subscription_false_positive_risk");
    expect(check(`สมัคร ${service} รายเดือน 70 บาท cash`).gate.autoSave).toBe(true);
    expect(check(`ไม่ได้สมัคร ${service} รายเดือน 70 บาท cash`).gate.autoSave).toBe(false);
  });
  it("blocks unresolved subscription sources even with consent to the default", () => {
    expect(check("สมัคร Netflix รายเดือน 70 บาท", { defaultAccountEstablishedByUser: true, defaultAccountId: "cash" }).gate.reasons).toContain("subscription_account_unresolved");
  });
  it("blocks duplicate uncertainty and leaves direction conservative", () => {
    expect(check("จ่ายข้าว 70 บาท cash", { duplicateUncertain: true }).gate.question?.field).toBe("duplicate");
    expect(check("70 cash").gate.question?.field).toBe("direction");
    expect(check("รับเงินงานออกแบบ 70 บาท cash").gate.reasons).toContain("ambiguous_direction");
    expect(check("โอนระหว่างบัญชี 70 บาท cash").gate.autoSave).toBe(false);
  });
  it("does not silently choose among named or archived accounts", () => {
    expect(check("จ่ายข้าว 70 บาท cash KBank").gate.autoSave).toBe(false);
    expect(check("จ่ายข้าว 70 บาท cash", { accounts: base.accounts.map(a => ({ ...a, is_archived: true })) }).gate.autoSave).toBe(false);
  });
  it("blocks contradictory direction and hypothetical spending", () => {
    expect(check("จ่ายเงินเดือนพนักงาน 70 บาท cash").gate.autoSave).toBe(false);
    expect(check("ยังไม่ได้จ่ายข้าว 70 บาท cash").gate.autoSave).toBe(false);
  });
  it("does not pick among emergency accounts without a user link", () => {
    const accounts = [...base.accounts, { ...base.accounts[2], id: "emergency-two" }];
    expect(check("ใช้เงินฉุกเฉินจ่ายข้าว 70 บาท", { accounts, emergencyFundAccountId: null }).gate.autoSave).toBe(false);
    expect(check("ใช้เงินฉุกเฉินจ่ายข้าว 70 บาท", { accounts }).gate.autoSave).toBe(true);
  });
  it("preserves legacy amount selection and exposes all candidates separately", () => {
    const { parsed, gate } = check("จ่ายข้าว 70 บาท หรือ 90 บาท cash");
    expect(parsed.amountCents).toBe(9000);
    expect(gate.fields.amount.reliable).toBe(false);
    expect(new Set(REASON_PRIORITY).size).toBe(REASON_PRIORITY.length);
  });
});

describe("evaluation safety accounting", () => {
  const one = (expected: object, tags: string[] = []): CaptureCorpus => ({ context: base, items: [{ id: "adversarial-label", text: "จ่ายข้าว 70 บาท cash", tags, expected: { amountCents: 7000, direction: "expense", date: base.today, accountId: "cash", autoSave: true, reasons: [], questionField: null, ...expected } }] });
  it.each(["amountCents", "direction", "date", "accountId"])("reports a critical failure for wrong %s on an automatic capture", field => {
    const report = evaluateCorpus(one({ [field]: "wrong" }));
    expect(report.criticalFailures).toHaveLength(1);
    expect(report.autoSavePrecision).toBe(0);
  });
  it("reports priority-case unsafe eligibility even when extracted fields match", () => {
    expect(evaluateCorpus(one({ autoSave: false }, ["priority_synthetic"])).criticalFailures).toHaveLength(1);
  });
  it("supports acceptable alternatives and reports no-saves precision as undefined", () => {
    expect(evaluateCorpus(one({ amountCents: 9000, alternatives: { amountCents: [7000] } })).autoSavePrecision).toBe(1);
    const corpus = one({ autoSave: false });
    corpus.items[0].context = { duplicateUncertain: true };
    expect(evaluateCorpus(corpus).autoSavePrecision).toBeNull();
  });
});
