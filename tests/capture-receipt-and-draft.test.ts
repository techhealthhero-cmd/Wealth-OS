import { describe, expect, it } from "vitest";

import { normalizeReceiptDate, normalizeReceiptModelOutput } from "@/lib/capture/receipt-normalize";
import { buildCaptureSaveInput, canSaveDraft, type CaptureDraft } from "@/lib/capture/draft";

const TODAY = "2026-09-29";

describe("normalizeReceiptModelOutput", () => {
  it("reads a clean payment-slip JSON reply", () => {
    const r = normalizeReceiptModelOutput(
      '{"is_payment_document":true,"amount":249,"date":"2026-09-29","time":"12:41","merchant":"KFC","payment_method":"KBank","reference":"015272123456","confidence":"high"}',
      TODAY
    );
    expect(r).toEqual({
      isPaymentDocument: true,
      amountCents: 24900,
      date: "2026-09-29",
      time: "12:41",
      merchant: "KFC",
      paymentMethod: "KBank",
      reference: "015272123456",
      confidence: "high",
    });
  });

  it("tolerates prose around the JSON and string amounts with commas", () => {
    const r = normalizeReceiptModelOutput('Here you go:\n{"amount":"1,250.50","merchant":"Big C","confidence":"medium"}\nThanks', TODAY);
    expect(r.amountCents).toBe(125050);
    expect(r.merchant).toBe("Big C");
  });

  it("converts Buddhist-era years (Thai slips)", () => {
    expect(normalizeReceiptModelOutput('{"amount":80,"date":"2569-09-28","merchant":"x"}', TODAY).date).toBe("2026-09-28");
  });

  it("missing amount is never high confidence", () => {
    const r = normalizeReceiptModelOutput('{"amount":null,"merchant":"KFC","confidence":"high"}', TODAY);
    expect(r.amountCents).toBeNull();
    expect(r.confidence).toBe("low");
  });

  it("missing merchant downgrades high to medium", () => {
    expect(normalizeReceiptModelOutput('{"amount":100,"merchant":null,"confidence":"high"}', TODAY).confidence).toBe("medium");
  });

  it("unreadable replies become an empty, low-confidence extraction (never throws)", () => {
    for (const bad of ["", "not json", "{broken", '{"amount": "abc"}']) {
      const r = normalizeReceiptModelOutput(bad, TODAY);
      expect(r.amountCents).toBeNull();
      expect(r.confidence).toBe("low");
    }
  });

  it("flags non-payment images", () => {
    expect(normalizeReceiptModelOutput('{"is_payment_document":false}', TODAY).isPaymentDocument).toBe(false);
  });

  it("drops placeholder strings like 'unknown'", () => {
    expect(normalizeReceiptModelOutput('{"amount":10,"merchant":"unknown","reference":"N/A"}', TODAY)).toMatchObject({
      merchant: null,
      reference: null,
    });
  });
});

describe("normalizeReceiptDate", () => {
  it("rejects future and invalid dates", () => {
    expect(normalizeReceiptDate("2026-10-05", TODAY)).toBeNull();
    expect(normalizeReceiptDate("2026-02-30", TODAY)).toBeNull();
    expect(normalizeReceiptDate("29/09/2026", TODAY)).toBeNull();
    expect(normalizeReceiptDate("2019-01-01", TODAY)).toBeNull();
  });
});

const DRAFT: CaptureDraft = {
  type: "expense",
  amountCents: 8000,
  categoryId: "11111111-1111-4111-8111-111111111111",
  categorySource: "keyword",
  accountId: "22222222-2222-4222-8222-222222222222",
  merchant: null,
  description: "ข้าว",
  date: TODAY,
  confidence: "high",
  source: "quick_text",
  categoryConfirmedByUser: false,
};
const KEY = "33333333-3333-4333-8333-333333333333";

describe("buildCaptureSaveInput", () => {
  it("stores the 'what' text in merchant, like the manual form", () => {
    expect(buildCaptureSaveInput(DRAFT, KEY)).toMatchObject({ merchant: "ข้าว", description: null, amountCents: 8000 });
  });

  it("keeps extra description only when it adds to a brand", () => {
    expect(buildCaptureSaveInput({ ...DRAFT, merchant: "Starbucks", description: "coffee" }, KEY)).toMatchObject({
      merchant: "Starbucks",
      description: "coffee",
    });
    expect(buildCaptureSaveInput({ ...DRAFT, merchant: "Grab", description: "Grab" }, KEY)).toMatchObject({
      merchant: "Grab",
      description: null,
    });
  });

  it("refuses to build without an amount or account", () => {
    expect(canSaveDraft({ ...DRAFT, amountCents: null })).toBe(false);
    expect(buildCaptureSaveInput({ ...DRAFT, amountCents: null }, KEY)).toBeNull();
    expect(buildCaptureSaveInput({ ...DRAFT, accountId: null }, KEY)).toBeNull();
  });

  it("truncates very long merchant names to the column limit", () => {
    const long = "ร้าน".repeat(100);
    expect(buildCaptureSaveInput({ ...DRAFT, description: long }, KEY)?.merchant?.length).toBe(120);
  });
});
