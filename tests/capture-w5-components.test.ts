import { createElement, type ReactElement } from "react";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n/dictionaries";
import { CaptureReviewCard } from "@/features/capture/components/capture-review-card";
import { CaptureTextSuggestion, CaptureLargeTextToggle } from "@/features/capture/components/capture-display-controls";
import { applyUnsureAnswer, buildUnsureQuestion, needsUnsureQuestion, pendingUnsureDraft } from "@/lib/capture/unsure-answer";
import { buildCaptureSaveInput, canSaveDraft, type CaptureDraft } from "@/lib/capture/draft";
import { parseCaptureText } from "@/lib/capture/transaction-parser";
import { createCaptureDeviceStore } from "@/lib/capture/capture-device-store";
import type { Account, Category } from "@/types/database";
const draft: CaptureDraft = { type: "expense", amountCents: 8500, accountId: "cash", categoryId: "food", categorySource: "keyword", merchant: "ข้าวมันไก่กับชาเย็น", description: null, date: "2026-10-20", confidence: "high", source: "voice", categoryConfirmedByUser: false };
const accounts = [{ id: "cash", name: "เงินสด", is_archived: false }] as Account[];
const categories = [{ id: "food", name_th: "อาหาร", name_en: "Food", type: "expense" }] as Category[];
const props = { draft, accounts, categories, largeText: false, compact: false, unsure: false, text: "ข้าวมันไก่กับชาเย็น 85 บาท", onAnswer: vi.fn(), onChange: vi.fn(), onSave: vi.fn(), disabled: false, saving: false };
function render(node: ReactElement) { return renderToStaticMarkup(jsx(I18nProvider, { locale: "th", dict: getDictionary("th"), children: node })); }
describe("capture review card", () => {
  it("renders the top review with editable category/account/date and a save button", () => {
    const html = render(createElement(CaptureReviewCard, props));
    expect(html).toContain('data-testid="capture-review-card"');
    for (const label of ["แก้ไขหมวดหมู่", "แก้ไขบัญชี", "แก้ไขวันที่", "บันทึก"]) expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain("อาหาร"); expect(html).toContain("เงินสด"); expect(html).not.toContain("94%");
  });
  it("large text shows three lines, words for direction, 44px amount, 72px Save, without chips/confidence/account", () => {
    const html = render(createElement(CaptureReviewCard, { ...props, largeText: true }));
    for (const word of ["อะไร", "เท่าไร", "วันไหน", "จ่ายไป", "text-[44px]", "min-h-[72px]"]) expect(html).toContain(word);
    for (const word of ["capture-review-chips", "เงินสด", "อาหาร", "94%", getDictionary("th").capture.confidenceHigh]) expect(html).not.toContain(word);
    expect(render(createElement(CaptureReviewCard, { ...props, largeText: true, draft: { ...draft, type: "income" } }))).toContain("ได้รับ");
  });
  it("B renders one-line summary while the viewport dock owns Save", () => {
    const html = render(createElement(CaptureReviewCard, { ...props, compact: true }));
    expect(html).toContain('aria-label="สรุปรายการ"'); expect(html).not.toContain('data-testid="capture-save"');
    // Fields remain mounted, offscreen, so an amount edit keeps native keyboard focus.
    expect(html).toContain('class="sr-only"');
  });
  it("asks just one question, exactly three choices, and offers pending Save", () => {
    const html = render(createElement(CaptureReviewCard, { ...props, unsure: true, draft: { ...draft, amountCents: 150000, description: "โอนให้น้องเมย์" }, text: "โอนให้น้องเมย์ 1500" }));
    expect(html.match(/data-testid="capture-unsure-question"/g)).toHaveLength(1);
    expect(html).toContain("โอน ฿1,500 ให้น้องเมย์ นี้คืออะไร?");
    for (const label of ["ค่าใช้จ่าย", "ให้ยืม (ทวงคืนได้)", "จ่ายค่าจ้างงาน", "บันทึกไว้ก่อน ถามทีหลัง"]) expect(html).toContain(label);
    expect(html.match(/min-h-\[52px\]/g)).toHaveLength(3);
  });
  it("own-account transfers use the transfer label and keep category guesses out of the review", () => {
    const html = render(createElement(CaptureReviewCard, { ...props, transfer: { label: "Cash → Bank", onEdit: vi.fn() } }));
    expect(html).toContain("โอนระหว่างบัญชี"); expect(html).toContain("Cash → Bank");
    expect(html).not.toContain("แก้ไขหมวดหมู่"); expect(html).not.toContain("จ่ายไป");
  });
  it("shows the suggestion inside the review while keeping Save present", () => {
    const suggestion = createElement(CaptureTextSuggestion, { amount: "฿85", onTry: vi.fn(), onDismiss: vi.fn() });
    const html = render(createElement(CaptureReviewCard, { ...props, suggestion }));
    expect(html).toContain('data-testid="capture-suggestion-card"'); expect(html).toContain('data-testid="capture-save"');
    expect(html).toContain("ตัวอย่างขนาดตัวอักษร"); expect(html.indexOf('data-testid="capture-suggestion-card"')).toBeLessThan(html.indexOf('data-testid="capture-save"'));
  });
  it("never enables save when a required existing flow is unresolved", () => {
    expect(render(createElement(CaptureReviewCard, { ...props, disabled: true }))).toMatch(/data-testid="capture-save"[^>]*disabled/);
  });
});
describe("unsure save routing", () => {
  const text = "โอนให้น้องเมย์ 1500";
  it("a remembered phrase resolves the same question while a different phrase still asks", () => {
    const data = new Map<string, string>();
    const repo = createCaptureDeviceStore("a", () => ({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } }));
    expect(needsUnsureQuestion(draft, text)).toBe(true);
    repo.remember(text, "expense");
    const question = (phrase: string) => !repo.answer(phrase) && needsUnsureQuestion(draft, phrase);
    expect(question("โอนให้น้องเมย์ 2000")).toBe(false); expect(question("โอนให้น้องแนน 2000")).toBe(true);
  });
  it("defer sends low confidence and no explicit category confirmation to the existing Inbox save rule", () => {
    const payload = buildCaptureSaveInput(pendingUnsureDraft(draft), "request");
    expect(payload?.confidence).toBe("low"); expect(payload?.categoryConfirmedByUser).toBe(false);
    expect(payload?.amountCents).toBe(8500); expect(payload?.accountId).toBe("cash");
  });
  it("lending records only a pending outgoing entry, preserving the label without creating an asset", () => {
    const next = applyUnsureAnswer(draft, "lend", categories);
    const payload = buildCaptureSaveInput(next, "request");
    expect(next.type).toBe("expense"); expect(next.smart).toBeUndefined(); expect(payload?.confidence).toBe("low"); expect(payload?.categoryConfirmedByUser).toBe(false);
    expect(payload?.merchant).toContain("ข้าวมันไก่"); expect(payload?.description).toContain("ให้ยืม");
  });
  it("does not guess a wage category or turn a wage payment into income", () => {
    const next = applyUnsureAnswer(draft, "wage", categories);
    expect(next.type).toBe("expense"); expect(next.categoryId).toBeNull(); expect(next.categoryConfirmedByUser).toBe(false);
  });
  it("choosing expense does not confirm a fallback category or ask a type question for a missing amount", () => {
    const next = applyUnsureAnswer({ ...draft, categorySource: "fallback" }, "expense", categories);
    expect(next.categoryConfirmedByUser).toBe(false); expect(next.confidence).toBe("low");
    expect(needsUnsureQuestion({ ...draft, amountCents: null }, text)).toBe(false);
  });
  it("keeps confidence and specialized required-decision gates", () => {
    expect(needsUnsureQuestion({ ...draft, subscription: { serviceName: "Netflix", frequency: "monthly" } }, text)).toBe(false);
    expect(needsUnsureQuestion({ ...draft, isEmergencyFundDraw: true }, text)).toBe(false);
    expect(canSaveDraft({ ...pendingUnsureDraft(draft), accountId: null })).toBe(false);
    expect(canSaveDraft({ ...pendingUnsureDraft(draft), confidenceGate: { reasons: ["memory_conflict"] } as CaptureDraft["confidenceGate"] })).toBe(false);
  });
});
describe("display controls", () => {
  it("renders a labeled switch and suggestion choices", () => {
    expect(render(createElement(CaptureLargeTextToggle, { enabled: true, onChange: vi.fn() }))).toContain('role="switch" aria-checked="true"');
    const html = render(createElement(CaptureTextSuggestion, { onTry: vi.fn(), onDismiss: vi.fn() }));
    for (const word of ["capture-suggestion-card", "ตัวหนังสือเล็กไปไหม?", "ลองเลย", "ไว้ก่อน"]) expect(html).toContain(word);
  });
});

describe("unsure question wording", () => {
  const context = { today: "2026-10-20", accounts: [], categories: [], merchantPreferences: [] };
  it("formats the parsed amount and recipient", () => {
    const parsed = parseCaptureText("โอนให้น้องเมย์ 1500", context);
    expect(buildUnsureQuestion(parsed)).toBe("โอน ฿1,500 ให้น้องเมย์ นี้คืออะไร?");
  });
  it("formats amount only when no recipient is parsed", () => {
    expect(buildUnsureQuestion({ amountCents: 150000, description: null })).toBe("โอน ฿1,500 นี้คืออะไร?");
    expect(buildUnsureQuestion({ amountCents: 150050, description: "ข้าว" })).toBe("โอน ฿1,500.50 นี้คืออะไร?");
  });
  it("uses a generic question when no amount is parsed", () => {
    expect(buildUnsureQuestion({ amountCents: null, description: "โอนให้น้องเมย์" })).toBe("รายการนี้คืออะไร?");
  });
});
