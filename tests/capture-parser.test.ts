import { describe, expect, it } from "vitest";

import {
  extractAmount,
  normalizeMerchant,
  parseCaptureText,
  suggestCategory,
  type ParseContext,
} from "@/lib/capture/transaction-parser";

const SYS = (id: string, name_th: string, name_en: string, type: "expense" | "income", icon: string) => ({
  id,
  name_th,
  name_en,
  type,
  icon,
  is_system: true,
});

const CTX: ParseContext = {
  today: "2026-09-29",
  accounts: [
    { id: "acc-kbank", name: "KBank ออมทรัพย์", account_type: "bank", institution: "Kasikorn", is_archived: false },
    { id: "acc-cash", name: "กระเป๋าตัง", account_type: "cash", institution: null, is_archived: false },
    { id: "acc-old", name: "บัญชีเก่า", account_type: "bank", institution: null, is_archived: true },
  ],
  categories: [
    SYS("cat-food", "อาหาร", "Food & Dining", "expense", "utensils"),
    SYS("cat-transport", "เดินทาง", "Transport", "expense", "car"),
    SYS("cat-utilities", "ค่าสาธารณูปโภค", "Utilities", "expense", "plug-zap"),
    SYS("cat-subs", "สมาชิก/Subscription", "Subscriptions", "expense", "repeat"),
    SYS("cat-shopping", "ช้อปปิ้ง", "Shopping", "expense", "shopping-bag"),
    SYS("cat-other", "อื่นๆ", "Other", "expense", "more-horizontal"),
    SYS("cat-salary", "เงินเดือน", "Salary", "income", "wallet"),
    SYS("cat-other-in", "อื่นๆ", "Other", "income", "more-horizontal"),
  ],
  merchantPreferences: [],
};

describe("parseCaptureText — required examples", () => {
  it("ข้าว 80 cash", () => {
    const r = parseCaptureText("ข้าว 80 cash", CTX);
    expect(r).toMatchObject({
      type: "expense",
      amountCents: 8000,
      categoryId: "cat-food",
      accountId: "acc-cash",
      accountSource: "matched",
      description: "ข้าว",
      date: "2026-09-29",
      confidence: "high",
    });
  });

  it("Grab 145", () => {
    const r = parseCaptureText("Grab 145", CTX);
    expect(r).toMatchObject({ amountCents: 14500, categoryId: "cat-transport", merchant: "Grab", description: "Grab" });
    // No account mentioned → the app's standard default (first active account).
    expect(r.accountId).toBe("acc-kbank");
    expect(r.accountSource).toBe("default");
    expect(r.confidence).toBe("high");
  });

  it("กาแฟ 75 บาท / ซื้อกาแฟ 75 บาท", () => {
    for (const text of ["กาแฟ 75 บาท", "ซื้อกาแฟ 75 บาท"]) {
      const r = parseCaptureText(text, CTX);
      expect(r).toMatchObject({ amountCents: 7500, categoryId: "cat-food", description: "กาแฟ" });
    }
  });

  it("ค่าไฟ 1200", () => {
    expect(parseCaptureText("ค่าไฟ 1200", CTX)).toMatchObject({
      amountCents: 120000,
      categoryId: "cat-utilities",
      description: "ค่าไฟ",
    });
  });

  it("ค่าไฟ 1200 จ่าย KBank", () => {
    expect(parseCaptureText("ค่าไฟ 1200 จ่าย KBank", CTX)).toMatchObject({
      amountCents: 120000,
      categoryId: "cat-utilities",
      accountId: "acc-kbank",
      accountSource: "matched",
      description: "ค่าไฟ",
    });
  });

  it("Netflix 419", () => {
    expect(parseCaptureText("Netflix 419", CTX)).toMatchObject({
      amountCents: 41900,
      categoryId: "cat-subs",
      merchant: "Netflix",
    });
  });

  it("เมื่อกี้กินข้าว 120 บาท จ่ายเงินสด", () => {
    expect(parseCaptureText("เมื่อกี้กินข้าว 120 บาท จ่ายเงินสด", CTX)).toMatchObject({
      amountCents: 12000,
      categoryId: "cat-food",
      accountId: "acc-cash",
      description: "ข้าว",
      date: "2026-09-29",
      confidence: "high",
    });
  });
});

describe("parseCaptureText — missing / edge cases", () => {
  it("missing category falls back to Other and asks for review (medium)", () => {
    const r = parseCaptureText("xyz 350", CTX);
    expect(r.categoryId).toBe("cat-other");
    expect(r.categorySource).toBe("fallback");
    expect(r.confidence).toBe("medium");
    expect(r.missing).toContain("category");
  });

  it("missing amount is low confidence and never guesses a number", () => {
    const r = parseCaptureText("ข้าวมันไก่", CTX);
    expect(r.amountCents).toBeNull();
    expect(r.confidence).toBe("low");
    expect(r.missing).toContain("amount");
    expect(r.categoryId).toBe("cat-food");
  });

  it("missing description uses the merchant, or stays null", () => {
    expect(parseCaptureText("7-11 59", CTX)).toMatchObject({ amountCents: 5900, merchant: "7-Eleven", description: "7-Eleven" });
    expect(parseCaptureText("250", CTX)).toMatchObject({ amountCents: 25000, description: null });
  });

  it("no accounts at all → low confidence, no account", () => {
    const r = parseCaptureText("ข้าว 80", { ...CTX, accounts: [] });
    expect(r.accountId).toBeNull();
    expect(r.confidence).toBe("low");
  });

  it("digits inside a brand are never read as the amount", () => {
    expect(parseCaptureText("7-11 45 บาท", CTX).amountCents).toBe(4500);
    expect(parseCaptureText("3BB 599", CTX)).toMatchObject({ amountCents: 59900, categoryId: "cat-utilities" });
  });

  it("yesterday / เมื่อวาน shift the date", () => {
    expect(parseCaptureText("ข้าว 80 เมื่อวาน", CTX).date).toBe("2026-09-28");
    expect(parseCaptureText("lunch 200 yesterday", CTX).date).toBe("2026-09-28");
  });

  it("Thai digits, commas, decimals and k", () => {
    expect(parseCaptureText("ค่าเช่า ๕,๐๐๐", CTX).amountCents).toBe(500000);
    expect(parseCaptureText("coffee 85.50", CTX).amountCents).toBe(8550);
    expect(parseCaptureText("shopee 1.2k", CTX)).toMatchObject({ amountCents: 120000, categoryId: "cat-shopping" });
  });

  it("income is detected from income words", () => {
    const r = parseCaptureText("เงินเดือน 35000", CTX);
    expect(r.type).toBe("income");
    expect(r.categoryId).toBe("cat-salary");
  });

  it("very long text keeps description within 200 chars", () => {
    const long = `${"ร้านอาหารชื่อยาวมาก ".repeat(30)} 99`;
    const r = parseCaptureText(long, CTX);
    expect(r.amountCents).toBe(9900);
    expect((r.description ?? "").length).toBeLessThanOrEqual(200);
  });

  it("archived accounts are never matched or defaulted", () => {
    expect(parseCaptureText("บัญชีเก่า 100", CTX).accountId).not.toBe("acc-old");
  });

  it("mixed Thai/English", () => {
    expect(parseCaptureText("ซื้อ coffee ที่ Starbucks 145 บาท", CTX)).toMatchObject({
      amountCents: 14500,
      categoryId: "cat-food",
      merchant: "Starbucks",
    });
  });
});

describe("category learning", () => {
  it("a learned merchant preference beats the keyword dictionary", () => {
    const ctx = { ...CTX, merchantPreferences: [{ merchant_normalized: "grab", category_id: "cat-food" }] };
    const r = parseCaptureText("Grab 180", ctx);
    expect(r.categoryId).toBe("cat-food");
    expect(r.categorySource).toBe("learned");
  });

  it("a learned free-text merchant is recognised inside a sentence", () => {
    const ctx = { ...CTX, merchantPreferences: [{ merchant_normalized: "ร้านป้าแดง", category_id: "cat-food" }] };
    expect(parseCaptureText("ร้านป้าแดง 60", ctx).categoryId).toBe("cat-food");
  });

  it("suggestCategory works for receipt merchants too", () => {
    expect(suggestCategory("KFC", "KFC", "expense", CTX)).toEqual({ categoryId: "cat-food", source: "keyword" });
  });

  it("normalizeMerchant collapses case/spacing", () => {
    expect(normalizeMerchant("  GRAB  ")).toBe("grab");
    expect(normalizeMerchant("7-Eleven!")).toBe("7-eleven");
  });
});

// Regression (Phase 1.5 live E2E): a preference learned for a merchant whose
// name contains punctuation normalizeMerchant() strips was saved correctly but
// never re-applied, because the lookup searched the raw text. These tests
// mirror the real round trip: the first capture's merchant/description is
// normalized exactly like learning.ts does, then the next capture must pick it up.
describe("category learning — learn → suggest round trip", () => {
  function learnedKey(firstCapture: string) {
    const first = parseCaptureText(firstCapture, CTX);
    return normalizeMerchant(first.merchant ?? first.description ?? "");
  }

  function suggestAfterLearning(firstCapture: string, nextCapture: string) {
    const ctx = { ...CTX, merchantPreferences: [{ merchant_normalized: learnedKey(firstCapture), category_id: "cat-food" }] };
    return parseCaptureText(nextCapture, ctx);
  }

  it.each([
    ["normal Thai", "ร้านป้าแดง 60", "ร้านป้าแดง 45", 4500],
    ["Thai with a space", "ป้า แดง 60", "ป้า แดง 45", 4500],
    ["underscore", "TEST_WEALTHOS_QX 57", "TEST_WEALTHOS_QX 67", 6700],
    ["hyphen", "TEST-WEALTHOS-QX 57", "TEST-WEALTHOS-QX 67", 6700],
    ["apostrophe", "Joe's Diner 90", "Joe's Diner 250", 25000],
    ["unicode apostrophe", "Joe’s Diner 90", "Joe’s Diner 250", 25000],
    ["apostrophe learned, unicode apostrophe typed", "Joe's Diner 90", "Joe’s Diner 250", 25000],
  ])("%s: learned Food is suggested next time", (_label, firstCapture, nextCapture, cents) => {
    const r = suggestAfterLearning(firstCapture, nextCapture);
    expect(r.amountCents).toBe(cents);
    expect(r.categoryId).toBe("cat-food");
    expect(r.categorySource).toBe("learned");
    expect(r.confidence).toBe("high");
  });

  it("the merchant text survives into the saved description", () => {
    expect(parseCaptureText("Joe's Diner 250", CTX).description).toBe("Joe's Diner");
  });

  it("a learned key does not leak into an unrelated merchant", () => {
    const r = suggestAfterLearning("TEST_WEALTHOS_QX 57", "TEST_WEALTHOS_QZ 67");
    expect(r.categorySource).toBe("fallback");
  });
});

describe("extractAmount", () => {
  it("prefers a number with a currency marker", () => {
    expect(extractAmount("ข้าว 2 จาน 120 บาท")?.cents).toBe(12000);
    expect(extractAmount("฿249 order 12")?.cents).toBe(24900);
  });
  it("returns null without a number", () => {
    expect(extractAmount("ข้าว")).toBeNull();
  });
});
