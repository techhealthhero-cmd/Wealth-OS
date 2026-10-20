import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sampleMonth, sampleReview } from "@/features/capture/components/slip-auto/__fixtures__/sample";
import { SlipReviewSheet, slipSaveCount } from "@/features/capture/components/slip-auto/slip-review-sheet";
import { MonthlySpendCard } from "@/features/dashboard/components/monthly-spend-card";
import { MonthlySpendDetail } from "@/features/dashboard/components/monthly-spend-detail";

const noop = () => {};
const renderReview = () =>
  renderToStaticMarkup(
    createElement(SlipReviewSheet, { vm: sampleReview, onAnswer: noop, onChangeCategory: noop, onSaveAll: noop })
  );

describe("slip-auto UI", () => {
  it("shows the unsure questions before the ready rows", () => {
    const html = renderReview();
    expect(html.indexOf("ถามนิดเดียว (2)")).toBeGreaterThan(-1);
    expect(html.indexOf("ถามนิดเดียว (2)")).toBeLessThan(html.indexOf("พร้อมบันทึก (9)"));
  });

  it("labels the save bar with ready + question count (unanswered counted as expense)", () => {
    expect(slipSaveCount(sampleReview)).toBe(11);
    const html = renderReview();
    expect(html).toContain("บันทึกทั้งหมด 11 รายการ");
    expect(html).toContain("นับเป็นรายจ่ายไปก่อน");
    expect(html).toContain('data-testid="slip-save-bar"');
  });

  it("folds duplicates into one details line and shows no confidence percent", () => {
    const html = renderReview();
    expect(html).toContain("<details");
    // Confidence is a bar (style width) only — no "93%" text node.
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/\d\s*%/);
  });

  it("renders nothing for the home card / detail when data is null", () => {
    expect(renderToStaticMarkup(createElement(MonthlySpendCard, { summary: null }))).toBe("");
    expect(renderToStaticMarkup(createElement(MonthlySpendCard, { summary: undefined }))).toBe("");
    expect(
      renderToStaticMarkup(createElement(MonthlySpendDetail, { summary: null, onMonthChange: noop }))
    ).toBe("");
  });

  it("renders the home card from real data", () => {
    const html = renderToStaticMarkup(createElement(MonthlySpendCard, { summary: sampleMonth }));
    expect(html).toContain("ใช้ไปแล้ว");
    expect(html).toContain('data-testid="monthly-spend-card"');
  });
});
