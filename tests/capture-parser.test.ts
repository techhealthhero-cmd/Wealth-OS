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

describe("emergency-fund source intent", () => {
  const sentence = "ตอนนี้ใช้เงินกระเป๋าสำรองฉุกเฉินอยู่ กินเบอร์เกอร์ 20";
  const fund = { ...CTX.accounts[0], id: "fund", name: "Savings", purpose: "เงินสำรองฉุกเฉิน" };
  it("cleans source chatter and flags an unresolved source while retaining the default", () => {
    expect(parseCaptureText(sentence, CTX)).toMatchObject({ type: "expense", amountCents: 2000,
      categoryId: "cat-food", description: "เบอร์เกอร์", accountId: "acc-kbank",
      accountSource: "default", isEmergencyFundDraw: true, emergencyFundAccountMissing: true });
  });
  it.each(["purpose", "name", "linked"])("resolves by %s", (mode) => {
    const account = mode === "name" ? { ...fund, purpose: null, name: "Emergency fund" } :
      mode === "linked" ? { ...fund, purpose: null } : fund;
    const ctx = { ...CTX, accounts: [...CTX.accounts, account], emergencyFundAccountId: mode === "linked" ? "fund" : null };
    expect(parseCaptureText(sentence, ctx)).toMatchObject({ accountId: "fund", accountSource: "matched",
      isEmergencyFundDraw: true, emergencyFundAccountMissing: false, description: "เบอร์เกอร์" });
    expect(parseCaptureText(`${sentence} cash`, ctx).accountId).toBe("fund");
  });
  it("prioritizes a valid link over purpose, bank hints and merchant preferences", () => {
    const ctx = { ...CTX, accounts: [...CTX.accounts, fund], emergencyFundAccountId: "acc-kbank",
      merchantAccounts: [{ merchant_normalized: "kfc", account_id: "acc-cash" }] };
    expect(parseCaptureText("ใช้เงินฉุกเฉิน kfc 50 cash", ctx)).toMatchObject({
      accountId: "acc-kbank", accountSource: "matched", isEmergencyFundDraw: true,
      emergencyFundAccountMissing: false, suggestedAccountId: null });
  });
  it("flags a missing source even when no default exists", () => {
    expect(parseCaptureText(sentence, { ...CTX, accounts: [] })).toMatchObject({
      accountId: null, isEmergencyFundDraw: true, emergencyFundAccountMissing: true, missing: ["account"] });
  });
  it("ignores archived and unknown links, falling back to active name/purpose", () => {
    for (const id of ["old-fund", "unknown"]) {
      const ctx = { ...CTX, emergencyFundAccountId: id, accounts: [...CTX.accounts,
        { ...fund, id: "old-fund", is_archived: true }, fund] };
      expect(parseCaptureText(sentence, ctx).accountId).toBe("fund");
      expect(parseCaptureText(sentence, { ...ctx, accounts: ctx.accounts.filter((a) => a.id !== "fund") })
        .emergencyFundAccountMissing).toBe(true);
    }
  });
  it.each(["เงินสำรองฉุกเฉิน", "เงินสำรอง ฉุกเฉิน", "กระเป๋าสำรองฉุกเฉิน", "กระเป๋าฉุกเฉิน", "เงินฉุกเฉิน", "บัญชีฉุกเฉิน", "กองทุนฉุกเฉิน", "emergency fund", "emergency"])("recognizes %s", (source) => {
    expect(parseCaptureText(`ใช้${source} ข้าว 50`, CTX)).toMatchObject({ amountCents: 5000, categoryId: "cat-food", description: "ข้าว", isEmergencyFundDraw: true });
  });
  it("supports English food and leaves ordinary captures unchanged", () => {
    expect(parseCaptureText("emergency fund burger 120", CTX)).toMatchObject({ amountCents: 12000, description: "burger", categoryId: "cat-food", isEmergencyFundDraw: true });
    expect(parseCaptureText("ข้าว 80 cash", CTX).isEmergencyFundDraw).toBe(false);
    expect(parseCaptureText("ซื้อกระเป๋า 500", CTX)).toMatchObject({ categoryId: "cat-shopping", isEmergencyFundDraw: false });
    expect(parseCaptureText("เงินสำรอง 500", CTX).isEmergencyFundDraw).toBe(false);
    expect(parseCaptureText("ได้รับเงินฉุกเฉิน 500", CTX).isEmergencyFundDraw).toBe(false);
    expect(parseCaptureText("nonemergency burger 120", CTX).isEmergencyFundDraw).toBe(false);
  });
  it.each(["เบอร์เกอร์", "เบอเกอร์", "burger", "แฮมเบอร์เกอร์", "hamburger", "แซนวิช", "แซนด์วิช", "sandwich", "สเต็ก", "steak", "ซูชิ", "sushi", "ราเมง", "ramen", "ข้าวผัด", "ไก่ทอด", "เฟรนช์ฟราย", "fries", "โดนัท", "donut", "เค้ก", "cake", "ไอศครีม", "สลัด", "salad", "pasta", "พาสต้า", "สปาเก็ตตี้", "ติ่มซำ", "หมูทอด", "ข้าวขาหมู", "ข้าวหมูแดง", "burger king", "เบอร์เกอร์คิง"])("categorizes %s as food", (food) => {
    expect(parseCaptureText(`${food} 120`, CTX).categoryId).toBe("cat-food");
  });
});

describe("subscription capture", () => {
  const subAccount = { id: "acc-sub", name: "บัญชีซับ", purpose: null, account_type: "bank" as const, institution: null, is_archived: false };
  const billCtx: ParseContext = { ...CTX, categories: [...CTX.categories, SYS("cat-housing", "ที่อยู่อาศัย", "Housing", "expense", "house")] };
  it.each([
    ["ค่าเช่าห้องเดือนละ 5000", "cat-housing", 500000],
    ["ค่าโทรศัพท์รายเดือน 599", "cat-utilities", 59900],
    ["ค่าเน็ตเดือนละ 650", "cat-utilities", 65000],
    ["ค่าเน็ตต่อเดือน 650", "cat-utilities", 65000],
    ["ผ่อนรถเดือนละ 8000", "cat-transport", 800000],
  ])("keeps the category and normal account for cadence-only bill %s", (text, categoryId, amountCents) => {
    for (const accounts of [CTX.accounts, [...CTX.accounts, subAccount]]) {
      const ctx = { ...billCtx, accounts };
      const parsed = parseCaptureText(text, ctx);
      expect(parsed).toMatchObject({
        subscription: { frequency: "monthly" }, categoryId, categorySource: "keyword", amountCents,
        accountId: "acc-kbank", accountSource: "default", subscriptionAccountMissing: false,
      });
      expect(suggestCategory(text, null, "expense", ctx)).toEqual({ categoryId, source: "keyword" });
    }
  });
  it("uses normal named, merchant-preferred and suggested accounts for cadence-only bills", () => {
    const ctx = { ...billCtx, accounts: [...CTX.accounts, subAccount] };
    expect(parseCaptureText("ค่าโทรศัพท์รายเดือน 599 cash", ctx)).toMatchObject({ categoryId: "cat-utilities", accountId: "acc-cash", accountSource: "matched", subscriptionAccountMissing: false });
    expect(parseCaptureText("ค่าเน็ต AIS เดือนละ 650", { ...ctx, merchantAccounts: [{ merchant_normalized: "ais", account_id: "acc-cash" }] }))
      .toMatchObject({ categoryId: "cat-utilities", accountId: "acc-cash", accountSource: "merchant", subscriptionAccountMissing: false });
    expect(parseCaptureText("ค่าเน็ต AIS เดือนละ 650", { ...ctx, accounts: [...ctx.accounts, { ...subAccount, id: "ais", name: "AIS" }] }))
      .toMatchObject({ categoryId: "cat-utilities", accountId: "acc-kbank", accountSource: "default", suggestedAccountId: "ais", subscriptionAccountMissing: false });
  });
  it.each(["บริการใหม่เดือนละ 500", "บริการใหม่รายปี 500"])("uses subscription defaults when cadence has no keyword category: %s", (text) => {
    expect(parseCaptureText(text, CTX)).toMatchObject({ categoryId: "cat-subs", subscriptionAccountMissing: true });
    expect(parseCaptureText(text, { ...CTX, accounts: [...CTX.accounts, subAccount] })).toMatchObject({ categoryId: "cat-subs", accountId: "acc-sub", accountSource: "subscription" });
  });
  it.each(["สมัคร", "สมัครสมาชิก", "ต่ออายุ", "ต่อสมาชิก", "ซับ", "sub", "subscribe", "subscription"])("%s overrides a generic keyword category", (signup) => {
    expect(parseCaptureText(`${signup} ค่าโทรศัพท์ 599`, { ...CTX, accounts: [...CTX.accounts, subAccount] }))
      .toMatchObject({ categoryId: "cat-subs", accountId: "acc-sub", accountSource: "subscription", subscriptionAccountMissing: false });
  });
  it.each(["Netflix", "Spotify", "YouTube Premium", "Disney+", "iCloud", "Google One", "ChatGPT", "Grok", "Duolingo", "Canva", "Adobe", "Apple Music", "LINE MAN Plus"])("known service %s overrides generic keywords without signup/cadence", (service) => {
    const text = `ค่าโทรศัพท์ ${service} 599`;
    const ctx = { ...CTX, accounts: [...CTX.accounts, subAccount] };
    expect(parseCaptureText(text, ctx)).toMatchObject({ categoryId: "cat-subs", accountId: "acc-sub", accountSource: "subscription", subscriptionAccountMissing: false });
    expect(suggestCategory(text, service, "expense", ctx)).toEqual({ categoryId: "cat-subs", source: "keyword" });
  });
  it.each(["Suburb Savings", "Subway", "Substantial", "MySubscriptions"])("ignores Latin substrings in account name and purpose: %s", (name) => {
    for (const account of [{ ...subAccount, name }, { ...subAccount, name: "Savings", purpose: name }]) {
      expect(parseCaptureText("สมัคร Netflix 419", { ...CTX, accounts: [...CTX.accounts, account] }))
        .toMatchObject({ accountId: "acc-kbank", accountSource: "default", subscriptionAccountMissing: true });
    }
  });
  it.each(["sub", "subs", "Subscription", "Subscriptions", "Monthly SUB fund", "บัญชีซับ", "เงินสมาชิก", "บริการรายเดือน"])("recognizes subscription account names and purposes: %s", (name) => {
    for (const account of [{ ...subAccount, name }, { ...subAccount, name: "Savings", purpose: name }]) {
      expect(parseCaptureText("สมัคร Netflix 419", { ...CTX, accounts: [...CTX.accounts, account] }))
        .toMatchObject({ accountId: "acc-sub", accountSource: "subscription", subscriptionAccountMissing: false });
    }
  });
  it.each([
    ["ยกเลิกตั๋วเครื่องบิน ได้เงินคืน 2000", 200000],
    ["ยกเลิกตั๋ว คืนเงิน 1500", 150000],
  ])("keeps refund amount and normal routing: %s", (text, amountCents) => {
    const parsed = parseCaptureText(text, { ...CTX, accounts: [...CTX.accounts, subAccount] });
    expect(parsed.cancelIntent).toBeFalsy();
    expect(parsed.subscription).toBeFalsy();
    expect(parsed.subscriptionAccountMissing).toBe(false);
    expect(parsed).toMatchObject({ amountCents, accountId: "acc-kbank", accountSource: "default" });
  });
  it.each([
    ["ฉันเพิ่งสมัครกรอก Grok Bot ไปจ่ายเดือนละ 1079 บาท", "Grok Bot", 107900, "monthly"],
    ["สมัคร Grok Bot 1079 บาทต่อเดือน", "Grok Bot", 107900, "monthly"],
    ["sub Netflix 419", "Netflix", 41900, "monthly"],
    ["subscribe YouTube Premium 179 รายเดือน", "YouTube Premium", 17900, "monthly"],
    ["ต่ออายุ iCloud ปีละ 1,190", "iCloud", 119000, "yearly"],
    ["subscription Spotify annual 199", "Spotify", 19900, "yearly"],
    ["สมัครสมาชิก Duolingo รายปี 1190", "Duolingo", 119000, "yearly"],
  ])("%s", (text, serviceName, amountCents, frequency) => {
    expect(parseCaptureText(text, { ...CTX, accounts: [...CTX.accounts, subAccount] })).toMatchObject({
      subscription: { serviceName, frequency }, merchant: serviceName, amountCents,
      categoryId: "cat-subs", categorySource: "keyword", accountId: "acc-sub", accountSource: "subscription", subscriptionAccountMissing: false,
    });
  });
  it("recognizes purpose and ignores archived accounts", () => {
    const accounts = [...CTX.accounts, { ...subAccount, is_archived: true }, { ...subAccount, id: "purpose", name: "Bills", purpose: "Subscription" }];
    expect(parseCaptureText("sub Netflix 419", { ...CTX, accounts }).accountId).toBe("purpose");
  });
  it("asks for an account when no subscription account exists", () => {
    expect(parseCaptureText("sub Netflix 419", CTX)).toMatchObject({ subscriptionAccountMissing: true, accountId: "acc-kbank", accountSource: "default" });
  });
  it("named accounts beat merchant settings which beat the subscription account", () => {
    const ctx = { ...CTX, accounts: [...CTX.accounts, subAccount], merchantAccounts: [{ merchant_normalized: "netflix", account_id: "acc-kbank" }] };
    expect(parseCaptureText("sub Netflix 419 cash", ctx)).toMatchObject({ accountId: "acc-cash", accountSource: "matched", merchant: "Netflix", subscriptionAccountMissing: false });
    expect(parseCaptureText("sub Netflix 419", ctx)).toMatchObject({ accountId: "acc-kbank", accountSource: "merchant", subscriptionAccountMissing: false });
  });
  it("paying an ordinary expense from a subscription account does not change its intent/category", () => {
    expect(parseCaptureText("ค่าข้าว 50 บัญชีซับ", { ...CTX, accounts: [...CTX.accounts, subAccount] }))
      .toMatchObject({ subscription: null, amountCents: 5000, categoryId: "cat-food", accountId: "acc-sub", accountSource: "matched" });
    expect(parseCaptureText("sub Netflix 419 จ่ายจาก cash", CTX)).toMatchObject({ merchant: "Netflix", subscription: { serviceName: "Netflix" }, accountId: "acc-cash" });
  });
  it("keeps learned service categories unless an explicit category word overrides them", () => {
    const ctx = { ...CTX, merchantPreferences: [{ merchant_normalized: "grok bot", category_id: "cat-shopping" }] };
    expect(parseCaptureText("Grok Bot 1079 cash", ctx))
      .toMatchObject({ categoryId: "cat-shopping", categorySource: "learned" });
    expect(parseCaptureText("สมัคร Grok Bot 1079 บาทต่อเดือน", ctx))
      .toMatchObject({ categoryId: "cat-shopping", categorySource: "learned" });
    expect(parseCaptureText("subscription Grok Bot 1079 cash", ctx))
      .toMatchObject({ categoryId: "cat-subs", categorySource: "keyword" });
  });
  it("recognizes Thai categories and falls back to existing Utilities", () => {
    const thaiOnly = CTX.categories.map((c) => c.id === "cat-subs" ? { ...c, name_en: "Custom", name_th: "บริการรายเดือน" } : c);
    expect(parseCaptureText("sub Netflix 419", { ...CTX, categories: thaiOnly }).categoryId).toBe("cat-subs");
    expect(parseCaptureText("sub Netflix 419", { ...CTX, categories: CTX.categories.filter((c) => c.id !== "cat-subs") })).toMatchObject({ categoryId: "cat-utilities", categorySource: "keyword" });
  });
  it.each(["ค่าข้าว 50", "สมัครเรียน 500", "สมัครงาน 100", "subway 200", "ค่ายกเลิกตั๋ว 200"])("does not mark %s as subscription", (text) => {
    expect(parseCaptureText(text, CTX).subscription).toBeFalsy();
    expect(parseCaptureText(text, CTX).amountCents).not.toBeNull();
  });
});
