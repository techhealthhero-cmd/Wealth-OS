import { describe, expect, it } from "vitest";

import { detectTransfer } from "@/lib/capture/transfer";
import type { CaptureAccount } from "@/lib/capture/transaction-parser";

const ACCOUNTS: CaptureAccount[] = [
  { id: "acc-cash", name: "Cash", account_type: "cash", institution: null, is_archived: false },
  { id: "acc-dime", name: "Dime", account_type: "investment" as CaptureAccount["account_type"], institution: null, is_archived: false },
  { id: "acc-kbank", name: "ออมทรัพย์", account_type: "bank", institution: "Kasikorn", is_archived: false },
  { id: "acc-card", name: "บัตร KTC", account_type: "credit_card", institution: null, is_archived: false },
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
    expect(detectTransfer("กาแฟ 80 Cash", ACCOUNTS)).toBeNull();
    expect(detectTransfer("ข้าว 120 จ่ายบัตร KTC กับ Cash", ACCOUNTS)).toBeNull();
  });
});
