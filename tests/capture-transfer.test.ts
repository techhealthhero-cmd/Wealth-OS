import { describe, expect, it } from "vitest";

import { detectTransfer, detectTransferIntent, normalizeAlias, soundKey } from "@/lib/capture/transfer";
import type { CaptureAccount } from "@/lib/capture/transaction-parser";

const ACCOUNTS: CaptureAccount[] = [
  { id: "acc-cash", name: "Cash", account_type: "cash", institution: null, is_archived: false },
  { id: "acc-dime", name: "Dime", account_type: "investment", institution: null, is_archived: false },
  { id: "acc-kbank", name: "ออมทรัพย์", account_type: "bank", institution: "Kasikorn", is_archived: false },
  { id: "acc-card", name: "บัตร KTC", account_type: "credit_card", institution: null, is_archived: false },
];

const WITH_TRIP: CaptureAccount[] = [
  ...ACCOUNTS,
  { id: "acc-trip", name: "ออมเงินเที่ยว", account_type: "savings", institution: "SCB", is_archived: false },
  { id: "acc-scb", name: "SCB", account_type: "bank", institution: null, is_archived: false },
  { id: "acc-kplus", name: "KBank", account_type: "bank", institution: null, is_archived: false },
];

describe("detectTransfer", () => {
  it("reads 'from X to Y' between the user's own accounts (reported 2026-10-10)", () => {
    expect(detectTransfer("โอนเงินจากบัญชี Cash ไปบัญชี Dime 3000", ACCOUNTS)).toEqual({ fromAccountId: "acc-cash", toAccountId: "acc-dime" });
    expect(detectTransfer("transfer from Dime to Cash 500", ACCOUNTS)).toEqual({ fromAccountId: "acc-dime", toAccountId: "acc-cash" });
  });

  it("works out the direction when the destination is said first", () => {
    expect(detectTransfer("โอนเข้า Dime จาก Cash 3000", ACCOUNTS)).toEqual({ fromAccountId: "acc-cash", toAccountId: "acc-dime" });
    // No direction words: first named is the source.
    expect(detectTransfer("โอน Cash Dime 3000", ACCOUNTS)).toEqual({ fromAccountId: "acc-cash", toAccountId: "acc-dime" });
  });

  it("resolves banks by their hint words", () => {
    expect(detectTransfer("โอนจากกสิกรไป Dime 2000", ACCOUNTS)).toEqual({ fromAccountId: "acc-kbank", toAccountId: "acc-dime" });
  });

  it("a cash withdrawal goes into the cash account", () => {
    expect(detectTransfer("ถอนเงินกสิกร 1000", ACCOUNTS)).toEqual({ fromAccountId: "acc-kbank", toAccountId: "acc-cash" });
  });

  it("paying someone or paying with a card is not a transfer", () => {
    expect(detectTransfer("โอนเงินให้แม่ 500", ACCOUNTS)).toBeNull();
    expect(detectTransfer("โอนจาก Cash ให้แม่ 500", ACCOUNTS)).toBeNull();
    expect(detectTransfer("โอนจาก Cash ไปให้พี่ 500", ACCOUNTS)).toBeNull();
    expect(detectTransfer("ตี๋โอนเงินมาให้ 500", ACCOUNTS)).toBeNull();
    expect(detectTransferIntent("กาแฟ 80 Cash", ACCOUNTS)).toBeNull();
    expect(detectTransferIntent("ข้าว 120 จ่ายบัตร KTC กับ Cash", ACCOUNTS)).toBeNull();
    expect(detectTransferIntent("พี่เจนโอนเงินให้ค่าวันเกิด 1000", ACCOUNTS)).toBeNull();
    expect(detectTransferIntent("โอนให้แม่ 500 จาก Cash แล้วใช้บัตร KTC", ACCOUNTS)).toBeNull();
    expect(detectTransferIntent("โอนจาก Cash ให้เพื่อน 500 แล้วค่อยเติม Dime", ACCOUNTS)).toBeNull();
    expect(detectTransferIntent("โอนให้พี่เจน 500 จาก Cash แล้วใช้บัตร KTC", ACCOUNTS)).toBeNull();
    expect(detectTransferIntent("โอนให้ร้าน 800 จาก Cash สำรองด้วย Dime", ACCOUNTS)).toBeNull();
  });
});

describe("soundKey", () => {
  it("gives Thai and English spellings of a name the same key", () => {
    expect(soundKey("ไดม์")).toBe(soundKey("Dime"));
    expect(soundKey("แคช")).toBe(soundKey("Cash"));
    expect(soundKey("ทรูมันนี่")).toBe(soundKey("TrueMoney"));
    expect(soundKey("ไดม์")).not.toBe(soundKey("ดื่มน้ำ"));
  });
});

describe("detectTransferIntent — names said differently", () => {
  it("matches a close-sounding name and says which word it heard", () => {
    expect(detectTransferIntent("โอนเงินจากเงินสดไปไดม์ 3000", ACCOUNTS)).toEqual({
      from: { status: "matched", accountId: "acc-cash", heard: null },
      to: { status: "matched", accountId: "acc-dime", heard: "ไดม์" },
    });
    expect(detectTransferIntent("โอนจากเอสซีบีไปเคแบงก์ 500", WITH_TRIP)).toEqual({
      from: { status: "matched", accountId: "acc-scb", heard: "เอสซีบี" },
      to: { status: "matched", accountId: "acc-kplus", heard: "เคแบงก์" },
    });
  });

  it("asks when several accounts fit", () => {
    expect(detectTransferIntent("โอนจากเงินสดเข้าบัญชีออม 5000", WITH_TRIP)?.to).toEqual({
      status: "ambiguous",
      candidates: ["acc-kbank", "acc-trip"],
      heard: "ออม",
    });
  });

  it("picks the only account that contains the word", () => {
    expect(detectTransferIntent("โอนจากเงินสดเข้าบัญชีออม 5000", ACCOUNTS)?.to).toEqual({ status: "matched", accountId: "acc-kbank", heard: "ออม" });
  });

  it("matches one word of a longer name, and never offers the source as the destination", () => {
    const demo: CaptureAccount[] = [
      { id: "cash", name: "เงินสด", account_type: "cash", institution: null, is_archived: false },
      { id: "kbank", name: "กสิกร ออมทรัพย์", account_type: "bank", institution: "KBank", is_archived: false },
      { id: "fixed", name: "เงินเก็บ (เงินฝากประจำ)", account_type: "savings", institution: "SCB", is_archived: false },
    ];
    // Speech wrote the bank as it sounds: "กะสิกอน".
    expect(detectTransferIntent("โอนจากเงินสดไปกะสิกอน 1000", demo)?.to).toEqual({ status: "matched", accountId: "kbank", heard: "กะสิกอน" });
    // "เงิน" fits เงินสด and เงินเก็บ, but เงินสด is the source — so it's เงินเก็บ.
    expect(detectTransferIntent("โอนจากเงินสดเข้าบัญชีเงิน 500", demo)?.to).toEqual({ status: "matched", accountId: "fixed", heard: "เงิน" });
  });

  it("an unknown account name is left for the user to pick", () => {
    expect(detectTransferIntent("โอนเงินเข้าบัญชีกระปุกหมู 1000", ACCOUNTS)).toEqual({
      from: { status: "matched", accountId: "acc-cash", heard: null },
      to: { status: "unknown", heard: "กระปุกหมู" },
    });
    expect(detectTransferIntent("โอนจาก Cash เข้ากระปุกหมู 1000", ACCOUNTS)?.to).toEqual({ status: "unknown", heard: "กระปุกหมู" });
    // Without "บัญชี" or a known source, a strange word is not assumed to be an account.
    expect(detectTransferIntent("โอนเงินไปกระปุกหมู 1000", ACCOUNTS)).toBeNull();
  });
});

describe("remembered nicknames (account_aliases)", () => {
  const withNick = ACCOUNTS.map((a) => (a.id === "acc-kbank" ? { ...a, aliases: [normalizeAlias("กระปุกหมู")] } : a));

  it("normalizes a nickname the way it is said", () => {
    expect(normalizeAlias("  บัญชีหุ้น ")).toBe("หุ้น");
    // "into my wallet" is heard as "wallet", so the nickname is stored the same way.
    expect(normalizeAlias("My Wallet")).toBe("wallet");
  });

  it("a remembered nickname resolves like the account's own name", () => {
    expect(detectTransfer("โอนเงินสดเข้ากระปุกหมู 1000", withNick)).toEqual({ fromAccountId: "acc-cash", toAccountId: "acc-kbank" });
    expect(detectTransfer("โอนเงินเข้าบัญชีกระปุกหมู 1000", withNick)).toEqual({ fromAccountId: "acc-cash", toAccountId: "acc-kbank" });
  });

  it("without the nickname the same words still ask", () => {
    expect(detectTransferIntent("โอนเงินเข้าบัญชีกระปุกหมู 1000", ACCOUNTS)?.to.status).toBe("unknown");
  });
});
