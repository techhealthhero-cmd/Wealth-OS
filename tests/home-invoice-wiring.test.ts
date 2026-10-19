import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import th from "@/i18n/locales/th.json";
import { HomeQuickActions } from "@/features/dashboard/components/home-quick-actions";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
describe("Home invoice quick action", () => {
  it("links invoice creation with an ordinary IconBox, while the tax jar stays coming soon", () => {
    const labels = {
      quickActionsLabel: "Quick actions",
      invoice: "ออกใบแจ้งหนี้",
      recordIncome: "รับเงิน",
      taxJar: "โหลภาษี",
      scanSlip: "สแกนสลิป",
      comingSoon: th.homeDash.comingSoon,
      invoiceSoon: "invoice-soon",
      taxJarSoon: "tax-soon",
    };
    const html = renderToStaticMarkup(createElement(HomeQuickActions, { labels }));
    expect(html).toContain('href="/money/invoices/new"');
    const tile = html.match(/<a [\s\S]*?<\/a>/)?.[0];
    expect(tile).toContain(labels.invoice);
    expect(tile).not.toContain("border-dashed");
    expect(tile).not.toContain(labels.comingSoon);
    expect(html).toContain(`${labels.taxJar} — ${labels.comingSoon}`);
    expect(html).not.toContain("invoice-soon");
  });
});
