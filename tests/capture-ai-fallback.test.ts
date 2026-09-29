import { describe, expect, it } from "vitest";

import { mergeAIParse, needsAIAssist, normalizeAIParseOutput, type AIParseFields } from "@/lib/capture/ai-fallback";
import { parseCaptureText, type ParseContext } from "@/lib/capture/transaction-parser";

const SYS = (id: string, name_th: string, name_en: string, type: "expense" | "income") => ({
  id, name_th, name_en, type, icon: null, is_system: true,
});

const CTX: ParseContext = {
  today: "2026-09-30",
  accounts: [
    { id: "acc-cash", name: "เงินสด", account_type: "cash", institution: null, is_archived: false },
    { id: "acc-kbank", name: "KBank", account_type: "bank", institution: "Kasikorn", is_archived: false },
    { id: "acc-scb", name: "SCB", account_type: "bank", institution: "SCB", is_archived: false },
    { id: "acc-cc", name: "บัตร KTC", account_type: "credit_card", institution: null, is_archived: false },
  ],
  categories: [
    SYS("cat-food", "อาหาร", "Food & Dining", "expense"),
    SYS("cat-transport", "เดินทาง", "Transport", "expense"),
    SYS("cat-utilities", "ค่าสาธารณูปโภค", "Utilities", "expense"),
    SYS("cat-groceries", "ของใช้ในบ้าน", "Groceries", "expense"),
    SYS("cat-housing", "ที่อยู่อาศัย", "Housing", "expense"),
    SYS("cat-other", "อื่นๆ", "Other", "expense"),
    SYS("cat-freelance", "ฟรีแลนซ์", "Freelance", "income"),
    SYS("cat-other-in", "อื่นๆ", "Other", "income"),
  ],
  merchantPreferences: [],
};

const input = (text: string) => ({ text, today: CTX.today, categories: CTX.categories });

describe("needsAIAssist — cost protection", () => {
  it.each(["ข้าว 80 cash", "Grab 145", "กาแฟ 75 บาท", "ค่าไฟ 1200 จ่าย KBank", "เมื่อกี้กินข้าว 120 บาท จ่ายเงินสด"])(
    "simple sentence stays rule-based (0 AI calls): %s",
    (text) => {
      expect(needsAIAssist(text, parseCaptureText(text, CTX))).toBe(false);
    }
  );

  it.each([
    "เมื่อคืนพาแฟนไปกินข้าวที่ร้าน Fuji จ่ายไป 1280 จากกสิกร",
    "เมื่อวานซื้อของเข้าบ้าน 860 ใช้บัตรเครดิต",
    "จ่ายค่าห้องไป 7500 เมื่อเช้าจาก SCB",
    "ได้เงินค่าฟรีแลนซ์จากลูกค้า 12000 เข้ากสิกร",
  ])("complex sentence gets one AI pass: %s", (text) => {
    expect(needsAIAssist(text, parseCaptureText(text, CTX))).toBe(true);
  });

  it("never without an amount — the model must not supply one", () => {
    const text = "เมื่อคืนพาแฟนไปกินข้าวที่ร้าน Fuji";
    expect(needsAIAssist(text, parseCaptureText(text, CTX))).toBe(false);
  });

  it("never for very long pastes", () => {
    const text = `เมื่อคืน ${"ข้าว ".repeat(80)} 120`;
    expect(needsAIAssist(text, parseCaptureText(text, CTX))).toBe(false);
  });
});

describe("normalizeAIParseOutput — never trust the model", () => {
  const text = "เมื่อคืนพาแฟนไปกินข้าวที่ร้าน Fuji จ่ายไป 1280 จากกสิกร";

  it("accepts fields grounded in the sentence", () => {
    const r = normalizeAIParseOutput(
      '{"type":"expense","amount":1280,"merchant":"Fuji","category":"Food & Dining","payment":"กสิกร","date":"2026-09-29","description":"พาแฟนไปกินข้าว","confidence":"high"}',
      input(text)
    );
    expect(r).toEqual({
      type: "expense", amountCents: 128000, merchant: "Fuji", categoryId: "cat-food",
      payment: "กสิกร", date: "2026-09-29", description: "พาแฟนไปกินข้าว", confidence: "high",
    });
  });

  it("drops an amount that isn't written in the sentence", () => {
    expect(normalizeAIParseOutput('{"amount":1500,"confidence":"high"}', input(text))?.amountCents).toBeNull();
  });

  it("drops a merchant that isn't in the sentence", () => {
    expect(normalizeAIParseOutput('{"merchant":"Sushiro","confidence":"high"}', input(text))?.merchant).toBeNull();
  });

  it("drops a category outside the user's list or of the wrong type", () => {
    expect(normalizeAIParseOutput('{"category":"Dining Out"}', input(text))?.categoryId).toBeNull();
    expect(normalizeAIParseOutput('{"type":"expense","category":"Freelance"}', input(text))?.categoryId).toBeNull();
  });

  it("drops future and too-old dates", () => {
    expect(normalizeAIParseOutput('{"date":"2026-10-01"}', input(text))?.date).toBeNull();
    expect(normalizeAIParseOutput('{"date":"2026-07-01"}', input(text))?.date).toBeNull();
    expect(normalizeAIParseOutput('{"date":"yesterday"}', input(text))?.date).toBeNull();
  });

  it("malformed replies are ignored, never thrown", () => {
    expect(normalizeAIParseOutput("sorry, I can't", input(text))).toBeNull();
    expect(normalizeAIParseOutput('{"type":"transfer"}', input(text))).toBeNull();
  });

  it("accepts amounts written with commas", () => {
    expect(normalizeAIParseOutput('{"amount":"12,000"}', input("ได้ค่าฟรีแลนซ์ 12,000 เข้ากสิกร"))?.amountCents).toBe(1200000);
  });
});

describe("mergeAIParse", () => {
  const base: AIParseFields = {
    type: null, amountCents: null, merchant: null, categoryId: null, payment: null, date: null, description: null, confidence: "high",
  };

  it("fixes merchant, date and description of a messy sentence while keeping the matched account", () => {
    const text = "เมื่อคืนพาแฟนไปกินข้าวที่ร้าน Fuji จ่ายไป 1280 จากกสิกร";
    const local = parseCaptureText(text, CTX);
    const r = mergeAIParse(text, local, { ...base, amountCents: 128000, merchant: "Fuji", categoryId: "cat-food", payment: "กสิกร", date: "2026-09-29", description: "พาแฟนไปกินข้าว" }, CTX);
    expect(r).toMatchObject({ amountCents: 128000, merchant: "Fuji", categoryId: "cat-food", accountId: "acc-kbank", date: "2026-09-29", description: "พาแฟนไปกินข้าว", confidence: "high" });
  });

  it("maps the AI payment hint to an account only when the rules defaulted", () => {
    const text = "ซื้อของที่ตลาดนัดหน้าหมู่บ้านแถวบ้านยาย 350";
    const local = parseCaptureText(text, CTX);
    expect(local.accountSource).toBe("default");
    const r = mergeAIParse(text, local, { ...base, payment: "SCB", categoryId: "cat-groceries" }, CTX);
    expect(r.accountId).toBe("acc-scb");
  });

  it("the user's learned merchant preference beats the model's category", () => {
    const ctx = { ...CTX, merchantPreferences: [{ merchant_normalized: "fuji", category_id: "cat-transport" }] };
    const text = "เมื่อคืนกินที่ Fuji 1280";
    const r = mergeAIParse(text, parseCaptureText(text, ctx), { ...base, merchant: "Fuji", categoryId: "cat-food" }, ctx);
    expect(r.categoryId).toBe("cat-transport");
    expect(r.categorySource).toBe("learned");
  });

  it("amount always comes from the sentence (rules) when the model gives none", () => {
    const text = "จ่ายค่าห้องไป 7500 เมื่อเช้าจาก SCB";
    const r = mergeAIParse(text, parseCaptureText(text, CTX), { ...base, categoryId: "cat-housing" }, CTX);
    expect(r.amountCents).toBe(750000);
  });

  it("never more confident than its weakest essential field", () => {
    const text = "ซื้ออะไรไม่รู้ที่ร้านแถวออฟฟิศเมื่อเช้า 99";
    const r = mergeAIParse(text, parseCaptureText(text, CTX), { ...base, categoryId: null, confidence: "high" }, CTX);
    expect(r.categorySource).toBe("fallback");
    expect(r.confidence).toBe("medium");
  });

  it("an AI income reading switches type and uses an income category", () => {
    const text = "ได้เงินค่าฟรีแลนซ์จากลูกค้า 12000 เข้ากสิกร";
    const r = mergeAIParse(text, parseCaptureText(text, CTX), { ...base, type: "income", categoryId: "cat-freelance", description: "ค่าฟรีแลนซ์" }, CTX);
    expect(r).toMatchObject({ type: "income", categoryId: "cat-freelance", accountId: "acc-kbank", amountCents: 1200000 });
  });
});
