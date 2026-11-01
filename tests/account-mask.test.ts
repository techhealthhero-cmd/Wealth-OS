import { describe, expect, it } from "vitest";

import { accountNumberMatches, masksCompatible, payerAccountMask } from "@/lib/capture/receipt-normalize";

/**
 * Thai bank slips hide different digits. The visible run is matched in its
 * own position (offset from the end of the mask), never as a bare suffix
 * and never as "these digits appear somewhere".
 */
describe("position-aware account masks", () => {
  const cases: { bank: string; printed: string; matches: string; misses: string }[] = [
    // K PLUS: xxx-x-x7513-x → positions 6–9 of a 10-digit account, last digit hidden.
    { bank: "K PLUS", printed: "xxx-x-x7513-x", matches: "1234575139", misses: "1234567513" },
    // SCB-style: xxx-x-xx123-4 → last four visible.
    { bank: "SCB", printed: "xxx-x-xx123-4", matches: "9876541234", misses: "1234987654" },
    // BBL: XXX-X-X1234-X → same window as K PLUS, different digits.
    { bank: "BBL", printed: "XXX-X-X1234-X", matches: "0012312348", misses: "0000001234" },
    // KTB: XXX-X-XX789-X → three visible digits, one hidden after them.
    { bank: "KTB", printed: "XXX-X-XX789-X", matches: "1111117890", misses: "1111111789" },
    // TTB: xxxxxx1234 → last four, mask as long as the account.
    { bank: "TTB", printed: "xxxxxx1234", matches: "5555551234", misses: "1234555555" },
    // GSB: xxx-xxx-5678 → last four after the dashes are stripped.
    { bank: "GSB", printed: "xxx-xxx-5678", matches: "1234565678", misses: "5678123456" },
  ];

  it.each(cases)("$bank keeps the visible digits in their printed position", ({ printed, matches, misses }) => {
    const mask = payerAccountMask(printed);
    expect(mask).toBeTruthy();
    expect(accountNumberMatches(mask as string, matches)).toBe(true);
    expect(accountNumberMatches(mask as string, misses)).toBe(false);
  });

  it("aligns a shorter or longer saved number by offset-from-end, not by suffix", () => {
    // K PLUS window: "7513" has one hidden digit after it.
    expect(accountNumberMatches("xxxxx7513x", "990000075139")).toBe(true);
    expect(accountNumberMatches("xxxxx7513x", "990000007513")).toBe(false);
    // The same digits as a suffix of a 10-digit number are a different account.
    expect(accountNumberMatches("xxx-x-x8710-x", "0000008710")).toBe(false);
    expect(accountNumberMatches("xxx-x-x8710-x", "0000087109")).toBe(true);
  });

  it("treats a digits-only legacy value as ending the number, not as a substring", () => {
    expect(accountNumberMatches("8710", "1234587101")).toBe(false);
    expect(accountNumberMatches("8710", "0000008710")).toBe(true);
  });

  it("treats two masks as the same account only where both show the same digits", () => {
    expect(masksCompatible("xxxxx8710x", "xxxxx8710x")).toBe(true);
    expect(masksCompatible("xxxxx8710x", "xxxxx9999x")).toBe(false);
    expect(masksCompatible("xxxxxx1234", "xxxxx1234x")).toBe(false);
  });
});
