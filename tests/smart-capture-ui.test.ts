import { jsx } from "react/jsx-runtime";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n/dictionaries";
import { SmartCaptureFields } from "@/features/capture/components/smart-capture-fields";
import { parsePurchaseIntent } from "@/lib/capture/purchase-intent";
import { canSaveDraft, type CaptureDraft } from "@/lib/capture/draft";
import { buildCaptureSaveInput } from "@/lib/capture/draft";
import { saveCaptureDraft } from "@/features/capture/save-capture-draft";
const plain = vi.hoisted(() => vi.fn(async () => ({ success: true })));
const smartSave = vi.hoisted(() => vi.fn(async () => ({ success: true })));
vi.mock("@/features/capture/actions", () => ({ saveCapturedTransaction: plain }));
vi.mock("@/features/capture/smart-capture-actions", () => ({ saveSmartCapture: smartSave }));
const date = "2026-10-19";
function draft(text: string, extra: Partial<CaptureDraft> = {}): CaptureDraft {
  const smart = parsePurchaseIntent(text, date)!;
  return { smart, type: smart.kind === "loan" ? "income" : "expense", amountCents: smart.amountCents, categoryId: null, categorySource: "fallback", accountId: "11111111-1111-4111-8111-111111111111", merchant: smart.assetName, description: null, date, confidence: "medium", source: "voice", categoryConfirmedByUser: false, ...extra };
}
function render(d: CaptureDraft, locale: "th" | "en") {
  return renderToStaticMarkup(jsx(I18nProvider, { locale, dict: getDictionary(locale), children: createElement(SmartCaptureFields, { draft: d, onChange: vi.fn() }) }));
}
describe("minimal smart confirmation", () => {
  it.each(["th", "en"] as const)("asks optional asset choice in %s", (locale) => {
    const d = draft("ซื้อหูฟัง 3500");
    expect(render(d, locale)).toContain(getDictionary(locale).capture.smart.askAsset);
    expect(canSaveDraft(d)).toBe(false);
    expect(canSaveDraft({ ...d, smartAssetAccepted: true })).toBe(true);
    expect(canSaveDraft({ ...d, smartAssetAccepted: false })).toBe(true);
  });
  it("preselects monthly for informal borrowing but still requires an explicit tap", () => {
    const d = draft("กู้นอกระบบ 20000 ดอก 20%");
    expect(render(d, "th")).toMatch(/aria-pressed="true"[^>]*>ต่อเดือน/);
    expect(canSaveDraft(d)).toBe(false);
    const confirmed = { ...d, smartRatePeriod: "month" as const };
    expect(canSaveDraft(confirmed)).toBe(true);
    const html = render(confirmed, "th");
    expect(html).toContain("6,014.11");
    expect(html).toContain(getDictionary("th").capture.smart.highInterest);
    expect(html).toContain("2026-11-19");
  });
  it("shows the zero-down phone plan and estimate hint", () => {
    const d = draft("ซื้อไอโฟน 40000 ผ่อน 0% 10 เดือน");
    expect(canSaveDraft(d)).toBe(true);
    const html = render(d, "en");
    expect(html).toContain("4,000");
    expect(html).toContain(getDictionary("en").capture.smart.estimate);
  });
  it("routes optional no to the existing expense path and yes to smart", async () => {
    plain.mockClear(); smartSave.mockClear();
    const d = draft("ซื้อหูฟัง 3500", { smartAssetAccepted: false });
    const payload = buildCaptureSaveInput(d, crypto.randomUUID())!;
    await saveCaptureDraft(d, payload);
    expect(plain).toHaveBeenCalledWith(payload); expect(smartSave).not.toHaveBeenCalled();
    await saveCaptureDraft({ ...d, smartAssetAccepted: true }, payload);
    expect(smartSave).toHaveBeenCalledWith(expect.objectContaining({ assetAccepted: true, capture: payload }));
  });
});

it("keeps required decisions pending when there are other saveable recap rows", async () => {
  const { smartCaptureNeedsAnswer } = await import("@/lib/capture/draft");
  expect(smartCaptureNeedsAnswer(draft("ซื้อหูฟัง 3500"))).toBe(true);
  expect(smartCaptureNeedsAnswer(draft("ซื้อหูฟัง 3500", { smartAssetAccepted: false }))).toBe(false);
  expect(smartCaptureNeedsAnswer(draft("กู้นอกระบบ 20000 ดอก 20%"))).toBe(true);
  expect(smartCaptureNeedsAnswer(draft("กู้นอกระบบ 20000 ดอก 20%", { smartRatePeriod: "year" }))).toBe(false);
});
