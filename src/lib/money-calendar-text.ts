import type { MonthGrid } from "@/lib/financial/week-strip";

// Render once on the server: Thai date/compact-number ICU output can differ in WebKit.
export function moneyCalendarText(grid: MonthGrid, locale: "th" | "en") {
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const label = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(dateLocale, { timeZone: "UTC", ...options }).format(new Date(`${date}T00:00:00Z`));
  const net = (cents: number) => {
    // Round the size, not the signed value: Math.round(-1443.5) is -1443,
    // while the month summary shows ฿1,444.
    const baht = Math.round(Math.abs(cents) / 100);
    const formatted = new Intl.NumberFormat(dateLocale, {
      maximumFractionDigits: baht >= 100_000 ? 1 : 0,
      notation: baht >= 100_000 ? "compact" : "standard",
    }).format(baht);
    return cents > 0 ? `+${formatted}` : cents < 0 ? `-${formatted}` : formatted;
  };
  return {
    title: label(`${grid.month}-01`, { month: "long", year: "numeric" }),
    dates: Object.fromEntries(grid.weeks.flat().map(day => [day.date, {
      narrow: label(day.date, { weekday: "narrow" }),
      long: label(day.date, { weekday: "long", day: "numeric", month: "long" }),
    }])),
    nets: Object.fromEntries([grid.netCents, ...grid.weeks.flat().map(day => day.netCents)].map(cents => [String(cents), net(cents)])),
  };
}
export type MoneyCalendarText = ReturnType<typeof moneyCalendarText>;
