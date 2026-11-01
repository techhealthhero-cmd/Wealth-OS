import { describe, expect, it } from "vitest";

import en from "@/i18n/locales/en.json";
import th from "@/i18n/locales/th.json";
import { pageTurnStyle } from "@/lib/motion/page-turn";

describe("page turn style", () => {
  it("fades every page turn, including Home", () => {
    expect(pageTurnStyle("home")).toBe("fade");
    expect(pageTurnStyle("section")).toBe("fade");
  });

  it("does not tell people to flip a paper corner on the month calendar", () => {
    expect(th.transactions.week).not.toHaveProperty("curlHint");
    expect(th.transactions.week).not.toHaveProperty("curlFold");
    expect(en.transactions.week).not.toHaveProperty("curlHint");
    expect(en.transactions.week).not.toHaveProperty("curlFold");
    expect(JSON.stringify(th.transactions.week)).not.toContain("พลิกมุม");
    expect(JSON.stringify(en.transactions.week)).not.toContain("Turn the corner");
    expect(JSON.stringify(en.transactions.week)).not.toContain("fold back");
  });

  it("says every page including Home fades, and Home swipe-back still closes the notebook", () => {
    const thItem = th.help.sections.find((section) => section.id === "money")?.items.find((item) => item.emoji === "📖");
    const enItem = en.help.sections.find((section) => section.id === "money")?.items.find((item) => item.emoji === "📖");
    expect(thItem?.description).toContain("ปัดจากหน้าแรกไปการเงิน");
    expect(thItem?.description).toContain("ปิดปกสมุด");
    expect(thItem?.description).toContain("ไม่พลิกกระดาษ");
    expect(thItem?.description).not.toContain("พลิกมุมกระดาษ");
    expect(thItem?.description).not.toContain("หน้าแรกยังพลิกกระดาษ");
    expect(enItem?.description).toContain("including a swipe from Home to Money");
    expect(enItem?.description).toContain("closes the cover");
    expect(enItem?.description).toContain("no paper curl");
    expect(enItem?.description).not.toContain("Home still turns like paper");
    expect(enItem?.description).not.toContain("Turn the corner");
  });
});
