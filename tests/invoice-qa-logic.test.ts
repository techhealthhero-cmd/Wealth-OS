import { describe, expect, it } from "vitest";
import { todayInTimeZone } from "@/lib/date";
import { defaultDueDate, formatThaiDate, resolveReceiveAccount } from "@/features/invoices/ui-logic";

const cash = { id: "cash", name: "Cash", account_type: "cash" };
const bank = { id: "bank", name: "Bank", account_type: "bank" };
describe("shared invoice receiving account", () => {
  it("prefers the invoice's valid account over a default", () => {
    expect(resolveReceiveAccount([cash, bank], bank.id, cash.id)).toEqual(bank);
  });
  it("uses a valid default for a blank or unavailable selection", () => {
    expect(resolveReceiveAccount([cash, bank], null, cash.id)).toEqual(cash);
    expect(resolveReceiveAccount([cash, bank], "archived", cash.id)).toEqual(cash);
  });
  it("preselects the only account for both form and detail", () => {
    expect(resolveReceiveAccount([cash])).toEqual(cash);
    expect(resolveReceiveAccount([cash], "deleted")).toEqual(cash);
  });
  it("does not guess among multiple accounts without a valid default", () => {
    expect(resolveReceiveAccount([cash, bank])).toBeNull();
    expect(resolveReceiveAccount([cash, bank], "deleted", "archived")).toBeNull();
    expect(resolveReceiveAccount([])).toBeNull();
  });
});
describe("invoice timezone boundaries (including a UTC server)", () => {
  it.each([
    ["2026-10-19T16:30:00Z", "2026-10-19"],
    ["2026-10-19T17:00:00Z", "2026-10-20"],
  ])("uses the Bangkok calendar day for %s", (instant, day) => {
    expect(todayInTimeZone("Asia/Bangkok", new Date(instant))).toBe(day);
    expect(todayInTimeZone(undefined, new Date(instant))).toBe(day);
    expect(defaultDueDate(day)).toBe(day === "2026-10-19" ? "2026-11-03" : "2026-11-04");
  });
  it("honors the profile timezone rather than the process timezone", () => {
    const now = new Date("2026-10-19T17:00:00Z");
    expect(todayInTimeZone("America/Los_Angeles", now)).toBe("2026-10-19");
    expect(todayInTimeZone("Asia/Tokyo", now)).toBe("2026-10-20");
    expect(todayInTimeZone("invalid", now)).toBe("2026-10-20");
  });
  it("renders issue, due and paid calendar dates without shifting the day", () => {
    expect(formatThaiDate("2026-10-19")).toBe("19 ต.ค. 2569");
    expect(formatThaiDate("2026-10-19", false, "en")).toBe("19 Oct 2026");
    expect(formatThaiDate("2026-11-03", true)).toBe("3 พ.ย.");
    expect(defaultDueDate("2026-12-25")).toBe("2027-01-09");
  });
});
