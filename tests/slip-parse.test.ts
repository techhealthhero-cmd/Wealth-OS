import { describe, expect, it } from "vitest";
import { BankCode, detectBank, parseSlipText } from "@/lib/slip";

describe("parseSlipText", () => {
  it("extracts synthetic Thai parties, amount, fee and reference", () => {
    const slip = parseSlipText(`โอนเงินสำเร็จ
19 ต.ค. 2569 14:05:33
จาก นาย ทดสอบ ตัวอย่าง
ธนาคารกสิกรไทย
xxx-x-x1234-x
ไปยัง นางสาว สมมติ ตัวอย่าง
ไทยพาณิชย์
พร้อมเพย์ 08x-xxx-5678
จำนวนเงิน 1,234.50 บาท
ค่าธรรมเนียม 0.00 บาท
เลขที่รายการ FAKE20261019`);
    expect(slip).toMatchObject({ amount: 123450, fee: 0, dateTime: "2026-10-19T14:05:33+07:00", reference: "FAKE20261019",
      sender: { name: "นาย ทดสอบ ตัวอย่าง", account: "xxx-x-x1234-x", bank: BankCode.KBANK },
      receiver: { name: "นางสาว สมมติ ตัวอย่าง", account: "08x-xxx-5678", bank: BankCode.SCB } });
    expect(slip.confidence.amount).toBeGreaterThan(0);
  });
  it.each(["19/10/2569", "19/10/69", "19 ตุลาคม 2569", "19 Oct 2026", "2026-10-19", "19/10/2026"])("parses %s", (date) => {
    expect(parseSlipText(`${date} 14:05\nAmount THB 10.25`).dateTime).toBe("2026-10-19T14:05:00+07:00");
  });
  it("handles Thai digits, spaced amounts and OCR substitutions without changing names", () => {
    const slip = parseSlipText("๑๙/๑๐/๒๕๖๙ 14:O5\nSender: Iona Test\nKTB\nxxx-l234-x\nReceiver: Olive Test\nBBL\n1-xxxx-xxxxx-12-3\nAmount ฿ l 2O0.O5\nFee ๑๐.๐๐ บาท");
    expect(slip).toMatchObject({ amount: 120005, fee: 1000, dateTime: "2026-10-19T14:05:00+07:00", sender: { name: "Iona Test", bank: BankCode.KTB, account: "xxx-1234-x" }, receiver: { name: "Olive Test", bank: BankCode.BBL } });
  });
  it("parses dotted Thai time", () => {
    expect(parseSlipText("19 ต.ค. 69 14.05 น.\n฿ 100").dateTime).toBe("2026-10-19T14:05:00+07:00");
  });
  it.each(["", "garbage !@#", "Oooo llll |||", "Amount -10.00", "Amount 9999999999999999999999.00"])("does not throw or invent money for %j", (text) => {
    const slip = parseSlipText(text);
    expect(slip.amount).toBeNull();
    for (const value of Object.values(slip.confidence)) expect(value).toBeGreaterThanOrEqual(0);
    expect(slip.overallConfidence).toBeLessThanOrEqual(1);
  });
  it.each(["31/02/2569 14:05", "19/10/2569 25:05", "19/10/2569 14:65", "19/10/2569"])("never invents a timestamp for %s", (text) => {
    expect(parseSlipText(text).dateTime).toBeNull();
  });
  it("retains a calendar date with missing time and supports next-line values", () => {
    expect(parseSlipText("19/10/2569\nจำนวนเงิน\n25.01 บาท\nRef:\nFAKE-123")).toMatchObject({ date: "2026-10-19", dateTime: null, amount: 2501, reference: "FAKE-123" });
  });
  it.each([
    ["KBank", BankCode.KBANK], ["SCB", BankCode.SCB], ["Krungthai", BankCode.KTB], ["Bangkok Bank", BankCode.BBL],
    ["กรุงศรี", BankCode.BAY], ["ทหารไทยธนชาต", BankCode.TTB], ["ออมสิน", BankCode.GSB], ["UOB", BankCode.UOB],
    ["CIMB", BankCode.CIMB], ["KKP", BankCode.KKP], ["LH Bank", BankCode.LH], ["ธ.ก.ส.", BankCode.BAAC], ["ธอส.", BankCode.GHB],
  ])("detects %s without assigning a header bank to both parties", (name, code) => {
    expect(detectBank(name)).toBe(code);
    const slip = parseSlipText(`${name}\nFrom: Synthetic Sender\nTo: Synthetic Receiver\n${name}\nAmount 10.00`);
    expect(slip.sender.bank).toBeNull();
    expect(slip.receiver.bank).toBe(code);
  });
  it.each(["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."])("supports month %s", (month) => {
    expect(parseSlipText(`19 ${month} 2569 14:05`).date).not.toBeNull();
  });
});

describe("additional OCR and calendar boundaries", () => {
  it.each([
    ["มกราคม", "01"], ["กุมภาพันธ์", "02"], ["มีนาคม", "03"], ["เมษายน", "04"],
    ["พฤษภาคม", "05"], ["มิถุนายน", "06"], ["กรกฎาคม", "07"], ["สิงหาคม", "08"],
    ["กันยายน", "09"], ["ตุลาคม", "10"], ["พฤศจิกายน", "11"], ["ธันวาคม", "12"],
  ])("parses full month %s", (month, number) => {
    expect(parseSlipText(`19 ${month} 2569 14:05`).dateTime).toBe(`2026-${number}-19T14:05:00+07:00`);
  });
  it.each(["O.1O", "0.I0", "0.|0", "0.l0", "๐.๑๐"])("parses exact satang from %s", (amount) => {
    expect(parseSlipText(`Amount ฿${amount}`).amount).toBe(10);
  });
  it("corrects standalone OCR years without altering names or references", () => {
    const parsed = parseSlipText("19 Oct 2O26 14:O5\nFrom Iona Test\nTo Olive Test\nAmount 0.10\nRef OI-FAKE");
    expect(parsed.dateTime).toBe("2026-10-19T14:05:00+07:00");
    expect(parsed.reference).toBe("OI-FAKE");
    expect(parsed.receiver.name).toBe("Olive Test");
  });
  it("accepts leap day but rejects impossible dates", () => {
    expect(parseSlipText("29/02/2567 00:00").dateTime).toBe("2024-02-29T00:00:00+07:00");
    expect(parseSlipText("29/02/2569 00:00").date).toBeNull();
  });
  it("supports the explicit reference year for ambiguous short years", () => {
    expect(parseSlipText("19/10/26 14:05", { referenceYear: 2026 }).date).toBe("2026-10-19");
  });
  it("does not treat Total as a receiver label", () => {
    expect(parseSlipText("From Synthetic Sender\nTotal 100.00").receiver.name).toBeNull();
  });
  it.each(["12,34.56", "1.234", "1e3", "-1", "NaN", "10.00 xyz"])("rejects malformed monetary text %s", (amount) => {
    expect(parseSlipText(`Amount ${amount}`).amount).toBeNull();
  });
  it.each(["xxx-xxx-1234", "08x-xxx-5678", "1-xxxx-xxxxx-12-3", "xxx-xxxx-6789"])("retains masked account %s", (account) => {
    expect(parseSlipText(`To Synthetic Receiver\nPromptPay ${account}\nAmount 1`).receiver.account).toBe(account);
  });
});

it("never assigns a standalone fee to a missing transfer amount", () => {
  expect(parseSlipText("ค่าธรรมเนียม\n10.00 บาท")).toMatchObject({ amount: null, fee: 1000 });
});
it("handles time before the date, repeated amount whitespace and extended party labels", () => {
  expect(parseSlipText("Time 14:05\n19 Oct 2026\nSender name: Synthetic Sender\nผู้รับเงิน: นาย สมมติ ตัวอย่าง\nAmount 1  234.50 บาท")).toMatchObject({
    amount: 123450, dateTime: "2026-10-19T14:05:00+07:00", sender: { name: "Synthetic Sender" }, receiver: { name: "นาย สมมติ ตัวอย่าง" },
  });
});
it.each(["14:05:333", "14:05:99", "114:05"])("does not truncate malformed time %s", (time) => {
  expect(parseSlipText(`19/10/2569 ${time}`).dateTime).toBeNull();
});
it.each(["preferred account", "refinery", "transaction identity"])("does not invent references from words: %s", (text) => {
  expect(parseSlipText(text).reference).toBeNull();
});

it("parses exact decomposed Thai WebKit OCR E2E145587A", () => {
  const slip = parseSlipText(`โอนเงินสําเร็จ

21 ต.ค. 2569 08:15:20

จาก นาย ทดสอบตัวอย่าง
ธนาคารกสิกรไทย
XXX-X-X1234-x

ไปยัง ร้านกาแฟ ทดสอบ
ไทยพาณิชย์
XXX-X-X5678-X

จํานวนเงิน 65.00 บาท

ค่าธรรมเนียม 0.00 บาท
เลขที่รายการ E2E145587A
`);
  expect(slip).toMatchObject({
    amount: 6500, date: "2026-10-21", reference: "E2E145587A",
    sender: { account: "XXX-X-X1234-x" }, receiver: { account: "XXX-X-X5678-X" },
  });
});

it("parses exact decomposed Thai WebKit OCR E2E145587C", () => {
  const slip = parseSlipText(`โอนเงินสําเร็จ

21 ต.ค. 2569 18:02:44

จาก นาย ทดสอบตัวอย่าง
ธนาคารกสิกรไทย
XXX-X-X1234-x

ไปยัง ปั๊มน้ามัน ตัวอย่าง
ไทยพาณิชย์
XXX-X-X5678-X

จํานวนเงิน 800.00 บาท

ค่าธรรมเนียม 0.00 บาท
เลขที่รายการ E2E145587C
`);
  expect(slip).toMatchObject({
    amount: 80000, date: "2026-10-21", reference: "E2E145587C",
    sender: { account: "XXX-X-X1234-x" }, receiver: { account: "XXX-X-X5678-X" },
  });
});
