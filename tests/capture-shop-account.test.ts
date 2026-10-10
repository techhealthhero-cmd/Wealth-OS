import { describe, expect, it } from "vitest";

import { accountsNamedForMerchant, parseCaptureText, shopKey, type ParseContext } from "@/lib/capture/transaction-parser";
import { detectTransferIntent, type AliasedAccount } from "@/lib/capture/transfer";

const ACCOUNTS: AliasedAccount[] = [
  { id: "cash", name: "Cash", account_type: "cash", institution: "กสิกร", is_archived: false },
  { id: "dime", name: "Dime", account_type: "investment", institution: null, is_archived: false },
  // The user's real naming (2026-10-10): spaces around the dash.
  { id: "seven", name: "7 - Eleven", account_type: "e_wallet", institution: "True money", is_archived: false },
];

const CTX: ParseContext = {
  today: "2026-10-10",
  accounts: ACCOUNTS,
  categories: [{ id: "food", name_th: "อาหาร", name_en: "Food & Dining", type: "expense", icon: null, is_system: true }],
  merchantPreferences: [],
};

describe("shop → pay-from account", () => {
  it("finds the account named after a shop, however it's spelled", () => {
    expect(accountsNamedForMerchant("7-Eleven", ACCOUNTS)).toEqual(["seven"]);
    expect(accountsNamedForMerchant("7-Eleven", [{ ...ACCOUNTS[2], name: "7-Eleven Wallet" }])).toEqual(["seven"]);
    expect(accountsNamedForMerchant("Grab", ACCOUNTS)).toEqual([]);
  });

  it("stores a shop by its canonical name", () => {
    expect(shopKey("เซเว่น")).toEqual({ key: "7-eleven", label: "7-Eleven" });
    expect(shopKey("ร้านกาแฟป้าแดง")).toEqual({ key: "ร้านกาแฟป้าแดง", label: "ร้านกาแฟป้าแดง" });
  });

  it("first time: keeps the default account but suggests the shop's wallet (reported 2026-10-10)", () => {
    const parsed = parseCaptureText("วันนี้จ่ายซื้อแซนวิชแฮมชีสในเซเว่นไป 30 บาท", CTX);
    expect(parsed).toMatchObject({ amountCents: 3_000, merchant: "7-Eleven", accountId: "cash", accountSource: "default", suggestedAccountId: "seven" });
  });

  it("once set, a purchase at the shop is paid from its account", () => {
    const ctx = { ...CTX, merchantAccounts: [{ merchant_normalized: "7-eleven", account_id: "seven" }] };
    expect(parseCaptureText("เซเว่น ข้าวกะเพรา 45", ctx)).toMatchObject({ accountId: "seven", accountSource: "merchant", suggestedAccountId: null });
    // An account said out loud still wins.
    expect(parseCaptureText("เซเว่น ข้าว 45 จ่ายเงินสด", ctx)).toMatchObject({ accountId: "cash", accountSource: "matched" });
  });

  it("a shop the user typed in matches inside the words", () => {
    const ctx = { ...CTX, merchantAccounts: [{ merchant_normalized: "ร้านป้าแดง", account_id: "dime" }] };
    expect(parseCaptureText("กาแฟร้านป้าแดง 45", ctx)).toMatchObject({ accountId: "dime", accountSource: "merchant" });
  });

  it("an archived account is never used or suggested", () => {
    const archived = ACCOUNTS.map((a) => (a.id === "seven" ? { ...a, is_archived: true } : a));
    const ctx = { ...CTX, accounts: archived, merchantAccounts: [{ merchant_normalized: "7-eleven", account_id: "seven" }] };
    expect(parseCaptureText("เซเว่น ข้าว 45", ctx)).toMatchObject({ accountId: "cash", suggestedAccountId: null });
  });
});

describe("topping up a shop wallet is a transfer", () => {
  it("เติมเงินเข้าแอปเซเว่น → Cash → the 7-Eleven account", () => {
    expect(detectTransferIntent("เติมเงินเข้าแอปเซเว่น 500", ACCOUNTS)).toEqual({
      from: { status: "matched", accountId: "cash", heard: null },
      to: { status: "matched", accountId: "seven", heard: "เซเว่น" },
    });
  });

  it("uses the shop's set account even when its name says nothing", () => {
    const named = ACCOUNTS.map((a) => (a.id === "seven" ? { ...a, name: "กระเป๋าเขียว", merchants: ["7-eleven"] } : a));
    expect(detectTransferIntent("เติมเงินเข้าเซเว่น 300", named)?.to).toEqual({ status: "matched", accountId: "seven", heard: "เซเว่น" });
  });

  it("other top-ups and refuelling stay expenses", () => {
    expect(detectTransferIntent("เติมน้ำมัน 500", ACCOUNTS)).toBeNull();
    expect(detectTransferIntent("เติมเงินมือถือ 100", ACCOUNTS)).toBeNull();
  });
});
