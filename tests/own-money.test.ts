import { describe, expect, it } from "vitest";

import { classifySlipMovement, isWalletTopUp, personNameKey, samePerson, transferRouteLabel } from "@/lib/capture/own-money";
import {
  calculateAccountBalance,
  calculateExpenses,
  calculateIncome,
  calculateSpendingByCategory,
} from "@/lib/financial/calculations";
import { aggregateHomeYear } from "@/features/dashboard/lib/home-year";
import { calculateBudgetStatus } from "@/lib/financial/budget";
import type { CaptureAccount, CaptureCategory } from "@/lib/capture/transaction-parser";
import { EMPTY_EXTRACTION, type ReceiptExtraction } from "@/lib/capture/receipt-normalize";
import { suggestSlipFields } from "@/lib/capture/slip-inbox";

const OWN = "own-cat";
const FOOD = "food";
const FROM = "from-acct";
const TO = "to-acct";
const categories: CaptureCategory[] = [
  { id: FOOD, name_th: "อาหาร", name_en: "Food & Dining", type: "expense", icon: "utensils", is_system: true },
  { id: OWN, name_th: "โอนตัวเอง/เติมกระเป๋า", name_en: "Own transfer", type: "transfer", icon: "wallet-topup", is_system: true },
];
const accounts: CaptureAccount[] = [
  { id: FROM, name: "กสิกร จ่าย", account_type: "bank", institution: "กสิกร", is_archived: false, account_number: "1234575139" },
  { id: TO, name: "บัญชีหลัก", account_type: "bank", institution: "กสิกร", is_archived: false, account_number: "1234587101" },
  { id: "wallet", name: "เป๋าตัง", account_type: "e_wallet", institution: "G-Wallet", is_archived: false },
];

function slip(over: Partial<ReceiptExtraction>): ReceiptExtraction {
  return { ...EMPTY_EXTRACTION, isPaymentDocument: true, amountCents: 40000, confidence: "medium", ...over };
}

describe("own-money detection", () => {
  it("strips Thai and English titles and masked chunks before comparing names", () => {
    expect(personNameKey("นาย พุฒิพงศ์ บำรุงรักษ์")).toBe(personNameKey("พุฒิพงศ์ บำรุงรักษ์"));
    expect(samePerson("นาย พุฒิพงศ์ บ", "นาย พุฒิพงศ์ บำรุงรักษ์")).toBe(true);
    expect(samePerson("น.ส. สมหญิง ใจดี", "สมหญิง ใจดี")).toBe(true);
    expect(samePerson("MR. Somchai Jaidee", "somchai jaidee")).toBe(true);
    expect(samePerson("นาย xxx พุฒิพงศ์", "พุฒิพงศ์ บำรุงรักษ์")).toBe(true);
    expect(samePerson("นาย ก", "นาย กมล")).toBe(false);
    expect(samePerson("นาย สมชาย", "นาง สมหญิง")).toBe(false);
  });

  it("recognises wallet billers and top-up notes, and leaves phone credit as spending", () => {
    expect(isWalletTopUp("พร้อมเพย์ อี-วอลเล็ต / G-Wallet", "เติมเป๋าตัง")).toBe(true);
    expect(isWalletTopUp("TrueMoney Wallet", null)).toBe(true);
    expect(isWalletTopUp("ShopeePay", null)).toBe(true);
    expect(isWalletTopUp("Rabbit LINE Pay", "top up")).toBe(true);
    expect(isWalletTopUp("เป๋าตัง", "เติมเงิน")).toBe(true);
    expect(isWalletTopUp("7-Eleven", "เติมเงินมือถือ")).toBe(false);
    expect(isWalletTopUp("ทรูมูฟ เอช", "เติมเงิน")).toBe(false);
    expect(isWalletTopUp("KFC", "ชาเขียว")).toBe(false);
  });

  it("classifies the screenshot top-up as a confident transfer, not อื่นๆ", () => {
    const suggestion = suggestSlipFields(
      slip({ merchant: "พร้อมเพย์ อี-วอลเล็ต / G-Wallet", note: "เติมเป๋าตัง", paymentMethod: "K PLUS", payerAccount: "xxxxx7513x" }),
      { accounts, categories, merchantPreferences: [], today: "2026-10-31" }
    );
    expect(suggestion).toMatchObject({ accountId: FROM, toAccountId: "wallet", categoryId: OWN, confidence: "high", ownMoney: true });
  });

  it("classifies a memo or the user's own name as a transfer even without a second account", () => {
    const memo = classifySlipMovement(
      { merchant: "นาย สมชาย ใจดี", note: "โอนไปบัญชีหลัก", senderName: null, payerAccount: null, receiverAccount: null, receiverBank: null, amountCents: 100000 },
      accounts,
      categories,
      null
    );
    expect(memo.ownMoney).toBe(true);
    expect(memo.categoryId).toBe(OWN);

    const named = classifySlipMovement(
      {
        merchant: "นาย พุฒิพงศ์ บำรุงรักษ์",
        note: null,
        senderName: "นาย พุฒิพงศ์ บ",
        payerAccount: "xxxxx7513x",
        receiverAccount: "xxx-x-x9999-x",
        receiverBank: "ธ.กสิกรไทย",
        amountCents: 100000,
      },
      accounts,
      categories,
      "พุฒิพงศ์ บำรุงรักษ์"
    );
    expect(named).toMatchObject({ ownMoney: true, fromAccountId: FROM, toAccountId: null, categoryId: OWN });
    expect(named.unsavedReceiver).toMatchObject({ bank: "ธ.กสิกรไทย", mask: "xxxxx9999x" });
  });

  it("matches both sides of a K PLUS self-transfer to the user's accounts", () => {
    const movement = classifySlipMovement(
      {
        merchant: "นาย พุฒิพงศ์ บำรุงรักษ์",
        note: "โอนไปบัญชีหลัก",
        senderName: "นาย พุฒิพงศ์ บ",
        payerAccount: "xxx-x-x7513-x",
        receiverAccount: "xxx-x-x8710-x",
        receiverBank: "ธ.กสิกรไทย",
        amountCents: 50000,
      },
      accounts,
      categories,
      "พุฒิพงศ์ บำรุงรักษ์"
    );
    expect(movement).toMatchObject({ ownMoney: true, fromAccountId: FROM, toAccountId: TO, categoryId: OWN, unsavedReceiver: null });
    expect(transferRouteLabel("กสิกร จ่าย", "บัญชีหลัก")).toBe("จาก กสิกร จ่าย → บัญชีหลัก");
  });
});

describe("own-money rows stay out of the totals", () => {
  const rent = { type: "expense" as const, amount: "80.00", category_id: "housing" };
  const topUp = { type: "transfer" as const, amount: "400.00", category_id: OWN };
  const between = { type: "transfer" as const, amount: "500.00", category_id: null, account_id: null, from_account_id: FROM, to_account_id: TO };

  it("is excluded from income, expenses, category breakdowns, the home year and a budget", () => {
    expect(calculateIncome([rent, topUp, between])).toBe(0);
    expect(calculateExpenses([rent, topUp, between])).toBe(8000);
    expect(calculateSpendingByCategory([rent, topUp, between])).toEqual([{ categoryId: "housing", totalCents: 8000 }]);

    const year = aggregateHomeYear(
      [
        { ...rent, transaction_date: "2026-06-01" },
        { ...topUp, transaction_date: "2026-06-02" },
        { type: "transfer", amount: "500.00", category_id: null, transaction_date: "2026-06-03" },
      ],
      [{ id: "housing", name_th: "ที่พัก", name_en: "Housing" }, { id: OWN, name_th: "โอนตัวเอง/เติมกระเป๋า", name_en: "Own transfer" }],
      2026,
      { locale: "th", uncategorized: "ไม่ระบุหมวด", other: "อื่นๆ" }
    );
    expect(year.expenseCents).toBe(8000);
    expect(year.incomeCents).toBe(0);
    expect(year.categories.map((row) => row.id)).toEqual(["housing"]);

    const budget = calculateBudgetStatus(100000, calculateExpenses([rent, topUp]), 10, 30);
    expect(budget.spentCents).toBe(8000);
  });

  it("moves both balances on a matched transfer and leaves a one-account top-up unposted", () => {
    const rows = [
      { type: "transfer" as const, amount: "500.00", from_account_id: FROM, to_account_id: TO },
      { type: "transfer" as const, amount: "400.00", account_id: FROM, category_id: OWN },
    ];
    expect(calculateAccountBalance(0, FROM, rows)).toBe(-50000);
    expect(calculateAccountBalance(0, TO, rows)).toBe(50000);
    expect(calculateAccountBalance(0, FROM, rows) + calculateAccountBalance(0, TO, rows)).toBe(0);
  });
});
