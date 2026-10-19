import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import th from "@/i18n/locales/th.json";
import en from "@/i18n/locales/en.json";
import { formatMoney } from "@/lib/financial/money";
import { HomeExpectedTileCard, type HomeExpectedTileProps } from "@/features/dashboard/components/home-tiles";

vi.mock("@/features/invoices/queries", () => ({ getReceivablesSummary: vi.fn() }));
import { getReceivablesSummary } from "@/features/invoices/queries";
import { HomeExpectedTile } from "@/features/dashboard/components/home-expected-tile";

const summary = { outstandingCents: 12345678, outstandingCount: 3, overdueCount: 0 };
function render(receivables: HomeExpectedTileProps["receivables"], labels = en.homeDash, currencyCode = "THB") {
  return renderToStaticMarkup(createElement(HomeExpectedTileCard, { labels, currencyCode, receivables }));
}

beforeEach(() => vi.resetAllMocks());

describe("Home expected tile presentation", () => {
  it.each([null, { ...summary, outstandingCount: 0 }])("preserves the empty state for %s", (receivables) => {
    const html = render(receivables);
    expect(html).toContain(en.homeDash.expectedEmpty);
    expect(html).toContain(en.homeDash.expectedHint.replaceAll("'", "&#x27;"));
    expect(html).not.toContain(en.homeDash.comingSoon);
    expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).not.toContain("invoices pending");
    expect(html).toContain('href="/money/invoices"');
    expect(html).toBe(render(null));
  });

  it.each([en.homeDash, th.homeDash])("shows the amount and localized count without a coming-soon chip", (labels) => {
    const html = render(summary, labels, "USD");
    expect(html).toContain(formatMoney(summary.outstandingCents, "USD", undefined, 0));
    expect(html).toContain(labels.expectedPending.replace("{count}", "3"));
    expect(html).toContain("font-bold tabular-nums");
    expect(html).not.toContain(labels.comingSoon);
    expect(html).not.toContain(labels.expectedEmpty);
    expect(html).not.toContain(labels.expectedOverdue.replace("{count}", "0"));
    expect(html).not.toContain("text-amber");
    expect(html).toContain('href="/money/invoices"');
  });

  it.each([en.homeDash, th.homeDash])("shows a calm localized overdue line only for overdue invoices", (labels) => {
    const html = render({ ...summary, overdueCount: 2 }, labels);
    expect(html).toContain(labels.expectedOverdue.replace("{count}", "2"));
    expect(html).toContain("text-amber-700 dark:text-amber-300");
  });
});

describe("Home expected tile loader", () => {
  it("renders exactly the empty fallback when the query returns an error", async () => {
    vi.mocked(getReceivablesSummary).mockResolvedValue({ error: "migration 0047 missing" });
    const tile = await HomeExpectedTile({ today: "2026-10-19", labels: en.homeDash });
    expect(getReceivablesSummary).toHaveBeenCalledExactlyOnceWith("2026-10-19");
    expect(renderToStaticMarkup(tile)).toBe(render(null));
  });

  it("also retains the empty fallback when the query rejects", async () => {
    vi.mocked(getReceivablesSummary).mockRejectedValue(new Error("unavailable"));
    expect(renderToStaticMarkup(await HomeExpectedTile({ today: "2026-10-19", labels: en.homeDash }))).toBe(render(null));
  });

  it("passes the existing summary and profile currency through to presentation", async () => {
    vi.mocked(getReceivablesSummary).mockResolvedValue({ success: true, ...summary, overdueCents: 0, rows: [] });
    const tile = await HomeExpectedTile({ today: "2026-10-19", labels: en.homeDash, currencyCode: "USD" });
    expect(renderToStaticMarkup(tile)).toBe(render(summary, en.homeDash, "USD"));
  });
});
