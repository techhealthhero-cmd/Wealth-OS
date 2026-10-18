import type { Locale } from "@/i18n/config";

/**
 * Short date line for the Home greeting — "อาทิตย์ 18 ต.ค." / "Sun, Oct 18".
 * Thai is assembled from parts because th-TH's long weekday carries a "วัน"
 * prefix the compact header doesn't need.
 */
export function formatGreetingDate(date: Date, locale: Locale): string {
  if (locale === "th") {
    const parts = new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "short" }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    return `${part("weekday").replace(/^วัน/, "")} ${part("day")} ${part("month")}`.trim();
  }
  return new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

/** Presentational date + greeting block for the mobile Home header. */
export function DashboardGreeting({
  date,
  locale,
  greeting,
}: {
  date: Date | string | number;
  locale: Locale;
  greeting: string;
}) {
  return (
    <div className="min-w-0">
      {/* The header renders on the server and the client; near midnight the
          two clocks can land on different days. */}
      <p className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
        {formatGreetingDate(new Date(date), locale)}
      </p>
      <h1 className="truncate text-xl font-bold leading-tight tracking-tight text-foreground">{greeting}</h1>
    </div>
  );
}
