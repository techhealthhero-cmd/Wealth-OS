import { describe, expect, it, vi } from "vitest";
import { formatFriendlyDate, formatMonthHeading, formatWeekday } from "@/lib/transaction-ui";
import { buildMonthGrid } from "@/lib/financial/week-strip";
import { moneyCalendarText } from "@/lib/money-calendar-text";

describe("money hydration text", () => {
  it("uses the server calendar day even if hydration crosses Bangkok midnight", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-20T17:01:00Z"));
      const labels = { today: "วันนี้", yesterday: "เมื่อวาน" };
      expect(formatFriendlyDate("2026-10-20", "th", labels, "2026-10-20")).toBe("วันนี้");
      expect(formatFriendlyDate("2026-10-19", "th", labels, "2026-10-20")).toBe("เมื่อวาน");
      expect(formatFriendlyDate("2026-10-20", "th", labels)).toBe("เมื่อวาน");
    } finally { vi.useRealTimers(); }
  });

  it("keeps calendar dates independent of process timezone", () => {
    const previous = process.env.TZ;
    try {
      const render = () => ({
        calendar: moneyCalendarText(buildMonthGrid("2026-10", "2026-10-20", [], []), "th"),
        month: formatMonthHeading("2026-10", "th"),
        weekday: formatWeekday("2026-10-20", "th"),
      });
      process.env.TZ = "UTC";
      const server = render();
      process.env.TZ = "Asia/Bangkok";
      expect(render()).toEqual(server);
      expect(JSON.parse(JSON.stringify(server))).toEqual(server);
      expect(server.calendar.dates["2026-10-20"].long).toContain("20");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
