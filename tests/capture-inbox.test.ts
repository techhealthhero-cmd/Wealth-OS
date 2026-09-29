import { describe, expect, it } from "vitest";

import { canBulkConfirm, inboxReviewReasons, isUndecidedCategory } from "@/lib/capture/inbox";

const CATS = [
  { id: "food", name_en: "Food & Dining", is_system: true },
  { id: "other", name_en: "Other", is_system: true },
  { id: "mine-other", name_en: "Other", is_system: false },
];

describe("isUndecidedCategory", () => {
  it("no category or the system 'Other' fallback is undecided", () => {
    expect(isUndecidedCategory(null, CATS)).toBe(true);
    expect(isUndecidedCategory("other", CATS)).toBe(true);
    expect(isUndecidedCategory("missing-id", CATS)).toBe(true);
  });

  it("a real category — including a user's own category named 'Other' — is decided", () => {
    expect(isUndecidedCategory("food", CATS)).toBe(false);
    expect(isUndecidedCategory("mine-other", CATS)).toBe(false);
  });
});

describe("inboxReviewReasons — tell the user WHY", () => {
  it("undecided category", () => {
    expect(inboxReviewReasons({ category_id: "other", source: "quick_text", ai_confidence: "medium" }, CATS)).toEqual(["category"]);
  });

  it("partly-read slip", () => {
    expect(inboxReviewReasons({ category_id: "food", source: "receipt", ai_confidence: "medium" }, CATS)).toEqual(["scan"]);
  });

  it("both at once", () => {
    expect(inboxReviewReasons({ category_id: null, source: "receipt", ai_confidence: "low" }, CATS)).toEqual(["category", "scan"]);
  });

  it("anything else gets a generic 'check details' reason, never an empty list", () => {
    expect(inboxReviewReasons({ category_id: "food", source: "quick_text", ai_confidence: "medium" }, CATS)).toEqual(["details"]);
  });
});

describe("canBulkConfirm — Confirm all never confirms incomplete items", () => {
  it("skips undecided categories", () => {
    expect(canBulkConfirm({ category_id: "other", source: "quick_text", ai_confidence: "medium" }, CATS)).toBe(false);
    expect(canBulkConfirm({ category_id: null, source: "receipt", ai_confidence: "low" }, CATS)).toBe(false);
  });

  it("allows complete items", () => {
    expect(canBulkConfirm({ category_id: "food", source: "receipt", ai_confidence: "medium" }, CATS)).toBe(true);
  });
});
