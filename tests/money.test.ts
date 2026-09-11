import { describe, expect, it } from "vitest";

import {
  centsToDecimalString,
  formatMoney,
  parseMoneyToCents,
} from "@/lib/financial/money";

describe("parseMoneyToCents", () => {
  it("parses whole decimal strings", () => {
    expect(parseMoneyToCents("1234.50")).toBe(123450);
  });

  it("parses integer strings with no decimal part", () => {
    expect(parseMoneyToCents("1000")).toBe(100000);
  });

  it("parses negative values", () => {
    expect(parseMoneyToCents("-50.25")).toBe(-5025);
  });

  it("pads single-decimal-digit strings", () => {
    expect(parseMoneyToCents("10.5")).toBe(1050);
  });

  it("avoids classic floating point drift (0.1 + 0.2 style cases)", () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754; cents-based math must not repeat that.
    const a = parseMoneyToCents("0.10");
    const b = parseMoneyToCents("0.20");
    expect(a + b).toBe(30);
  });

  it("handles large money values without precision loss", () => {
    expect(parseMoneyToCents("999999999999.99")).toBe(99999999999999);
  });

  it("rejects unparseable input", () => {
    expect(() => parseMoneyToCents("not-a-number")).toThrow();
  });
});

describe("centsToDecimalString", () => {
  it("round-trips whole and fractional amounts", () => {
    expect(centsToDecimalString(123450)).toBe("1234.50");
    expect(centsToDecimalString(5)).toBe("0.05");
    expect(centsToDecimalString(-5025)).toBe("-50.25");
  });
});

describe("formatMoney", () => {
  it("formats THB with the Thai locale by default", () => {
    const formatted = formatMoney(4000000, "THB");
    expect(formatted).toContain("40,000.00");
  });

  it("formats USD", () => {
    const formatted = formatMoney(150000, "USD");
    expect(formatted).toContain("1,500.00");
  });
});
