import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EarnHub } from "@/features/earn/components/v2/earn-hub";

vi.mock("@/features/earn/v2-queries", () => ({
  getEarnHubData: async () => ({ assessment: null, paths: [] }),
}));
vi.mock("@/features/income-profile/queries", () => ({ getIncomeProfileSummary: async () => ({}) }));
vi.mock("@/features/income-target/queries", () => ({ getIncomeTarget: async () => null }));
vi.mock("@/features/profile/queries", () => ({ getProfile: async () => null }));
vi.mock("@/features/account-privacy/queries", () => ({ getAccountPrivacyState: async () => ({}) }));
vi.mock("@/i18n/server", () => ({ getLocale: async () => "th" }));

describe("Earn intro server markup", () => {
  it("keeps the decorative icon out of paragraphs that HTML parsing would split before hydration", async () => {
    const html = renderToStaticMarkup(await EarnHub());
    expect(html).toContain('href="/earn/diagnostic"');
    expect(html).toContain('href="/earn/paths/new"');
    const paragraphs = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/g) ?? [];
    expect(paragraphs.length).toBeGreaterThan(0);
    for (const paragraph of paragraphs) {
      expect(paragraph.replace(/^<p\b[^>]*>/, "")).not.toMatch(/<(?:div|section|p|h[1-6])\b[^>]*>/g);
    }
  });
});
