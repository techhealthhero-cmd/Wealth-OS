import { jsx } from "react/jsx-runtime";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n/dictionaries";
import type { CaptureDraft } from "@/lib/capture/draft";
import { SubscriptionFields } from "@/features/capture/components/subscription-fields";
import { SubscriptionCancelCard, SubscriptionCancelPreview } from "@/features/capture/components/subscription-cancel-card";
import { TransactionPreview } from "@/features/capture/components/transaction-preview";

vi.mock("@/features/capture/actions", () => ({ findCancelCandidates: vi.fn(), cancelRecurringFromCapture: vi.fn() }));
const draft: CaptureDraft = { subscription: { serviceName: "Grok Bot", frequency: "monthly" }, subscriptionAccountMissing: false, type: "expense", amountCents: 107900, merchant: "Grok Bot", description: null, categoryId: null, categorySource: "keyword", accountId: "a", date: "2026-10-19", confidence: "high", source: "voice", categoryConfirmedByUser: false };
function render(node: React.ReactElement, locale: "th" | "en" = "th") {
  return renderToStaticMarkup(jsx(I18nProvider, { locale, dict: getDictionary(locale), children: node }));
}

describe("subscription preview controls", () => {
  it.each(["th", "en"] as const)("shows service, cadence and default checked toggle in %s", (locale) => {
    const dict = getDictionary(locale).capture.subscription;
    const html = render(createElement(SubscriptionFields, { draft, accounts: [], onChange: vi.fn() }), locale);
    expect(html).toContain("Grok Bot");
    expect(html).toContain(dict.monthly);
    expect(html).toContain(dict.addRecurring);
    expect(html).toMatch(/type="checkbox"[^>]*checked/);
    expect(html).not.toContain(dict.chooseAccount);
    const off = render(createElement(SubscriptionFields, { draft: { ...draft, addRecurring: false }, accounts: [], onChange: vi.fn() }), locale);
    expect(off).not.toMatch(/type="checkbox"[^>]*checked/);
  });
  it("asks for an account and blocks saving until the user chooses one", () => {
    const html = render(createElement(TransactionPreview, { draft: { ...draft, subscriptionAccountMissing: true }, accounts: [], categories: [], heading: "preview", onChange: vi.fn(), onSave: vi.fn(), onEdit: vi.fn(), saving: false, saveLabel: "SAVE" }));
    expect(html).toContain(getDictionary("th").capture.subscription.chooseAccount);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?SAVE/);
  });
  it("shows yearly copy, and cancellation requires a service and lookup instead of an expense", () => {
    expect(render(createElement(SubscriptionFields, { draft: { ...draft, subscription: { serviceName: "iCloud", frequency: "yearly" } }, accounts: [], onChange: vi.fn() }))).toContain("รายปี");
    const empty = render(createElement(SubscriptionCancelCard, { serviceQuery: "", onCancelled: vi.fn() }));
    expect(empty).toContain(getDictionary("th").capture.subscription.cancelEmpty);
    const pending = render(createElement(SubscriptionCancelCard, { serviceQuery: "Netflix", onCancelled: vi.fn() }));
    expect(pending).toContain(getDictionary("th").capture.subscription.cancelLoading);
    expect(pending).not.toContain('type="checkbox"');
  });
});


describe("subscription cancellation choices", () => {
  const grok = { id: "1", merchant: "Grok Bot", description: null, amount: "1079.00", frequency: "monthly" as const, is_active: true };
  const pro = { ...grok, id: "2", merchant: "Grok Pro" };
  const props = { serviceQuery: "Grok", selectedId: null, onSelect: vi.fn(), onConfirm: vi.fn(), saving: false };
  it("shows an explicit single-item confirmation with name, amount and cadence", () => {
    const html = render(createElement(SubscriptionCancelPreview, { ...props, match: { status: "single", item: grok } }));
    expect(html).toContain("Grok Bot");
    expect(html).toContain("1,079");
    expect(html).toContain(getDictionary("th").recurring.frequencies.monthly);
    expect(html).toContain(getDictionary("th").capture.subscription.cancelConfirm);
  });
  it("requires a selection when there are multiple matches", () => {
    const match = { status: "multiple" as const, candidates: [grok, pro] };
    const html = render(createElement(SubscriptionCancelPreview, { ...props, match }));
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).not.toContain(getDictionary("th").capture.subscription.cancelConfirm);
    const chosen = render(createElement(SubscriptionCancelPreview, { ...props, match, selectedId: "2" }));
    expect(chosen).toContain(getDictionary("th").capture.subscription.cancelConfirm);
    expect(chosen).toContain("ยกเลิก Grok Pro");
  });
  it("no match provides the query and a link to recurring items", () => {
    const html = render(createElement(SubscriptionCancelPreview, { ...props, match: { status: "none" } }));
    expect(html).toContain("Grok");
    expect(html).toContain('href="/money/recurring"');
    expect(html).not.toContain(getDictionary("th").capture.subscription.cancelConfirm);
  });
});
