import { describe, expect, it } from "vitest";
import { parseSlipQR, slipCRC } from "@/lib/slip/qr";
import { BankCode } from "@/lib/slip/banks";
function payload(bank = "014", ref = "SYNTHETIC-001", country = "TH") {
  const data = `00060000010103${bank}02${String(ref.length).padStart(2, "0")}${ref}`;
  const body = `00${data.length}${data}5102${country}9104`;
  return body + slipCRC(body);
}
describe("bank mini QR", () => {
  it("matches independently published wire CRC", () => {
    expect(parseSlipQR("004000060000010103002021900021231231212000115102TH91049C30")).toEqual({ sendingBankCode: "002", bankId: BankCode.BBL, transRef: "0002123123121200011" });
    expect(slipCRC("123456789")).toBe("29B1");
  });
  it.each([["014", BankCode.SCB], ["004", BankCode.KBANK], ["006", BankCode.KTB], ["002", BankCode.BBL], ["025", BankCode.BAY], ["011", BankCode.TTB], ["030", BankCode.GSB], ["024", BankCode.UOB], ["022", BankCode.CIMB], ["069", BankCode.KKP], ["073", BankCode.LH], ["034", BankCode.BAAC], ["033", BankCode.GHB]])("maps %s", (bank, bankId) => {
    expect(parseSlipQR(payload(bank))).toEqual({ sendingBankCode: bank, bankId, transRef: "SYNTHETIC-001" });
  });
  it("preserves unknown bank", () => expect(parseSlipQR(payload("999"))).toEqual({ sendingBankCode: "999", transRef: "SYNTHETIC-001" }));
  it("rejects corruption and truncated payloads", () => {
    const wire = payload();
    expect(parseSlipQR(wire.slice(0, -4) + "0000")).toBeNull();
    for (let length = 0; length < wire.length; length++) expect(parseSlipQR(wire.slice(0, length))).toBeNull();
    expect(parseSlipQR(wire + "junk")).toBeNull();
  });
  it("requires CRC as a root tag rather than CRC-shaped reference text", () => {
    const body = "0034000600000101030140213HELLO9104";
    expect(parseSlipQR(body + slipCRC(body))).toBeNull();
  });
  it("rejects wrong country, marker, missing/duplicate fields and excessive ref", () => {
    expect(parseSlipQR(payload("014", "x", "US"))).toBeNull();
    expect(parseSlipQR(payload("014", "x".repeat(26)))).toBeNull();
    for (const body of ["001000060000025102TH9104", "000701030145102TH9104", "0014010301401030145102TH9104"]) expect(parseSlipQR(body + slipCRC(body))).toBeNull();
  });
});
