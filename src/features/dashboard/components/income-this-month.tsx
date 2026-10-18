import { captureError } from "@/lib/observability";
import { todayInTimeZone } from "@/lib/date";
import { getMonthProgress } from "@/features/dashboard/lib/income-by-source";
import { getIncomeBySourceData, type IncomeBySourceData } from "@/features/dashboard/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import type { Locale } from "@/i18n/config";
import { InlineLoadError } from "@/components/shared/inline-load-error";
import { IncomeThisMonthCard } from "./income-this-month-card";

interface IncomeThisMonthData {
  locale: Locale;
  currencyCode: string;
  data: IncomeBySourceData;
}

/**
 * Data loading isolated in its own try/catch (never around JSX — see
 * net-worth-hero.tsx) so a failed read only replaces this card with an
 * inline error instead of failing the whole Home page.
 */
async function loadIncomeThisMonthData(): Promise<IncomeThisMonthData | null> {
  try {
    const profile = await getProfile();
    const locale = await getLocale(profile?.preferred_language);
    // The user's calendar day, not the server's (Vercel runs in UTC).
    const today = todayInTimeZone(profile?.timezone ?? "Asia/Bangkok");
    const data = await getIncomeBySourceData(locale, today);
    return { locale, currencyCode: profile?.currency_code ?? "THB", data };
  } catch (error) {
    captureError(error, { route: "dashboard.IncomeThisMonth", operation: "load_income_by_source" });
    return null;
  }
}

/** Home's first card: this month's received income, grouped by source. */
export async function IncomeThisMonth() {
  const loaded = await loadIncomeThisMonthData();
  if (!loaded) {
    const dict = getDictionary(await getLocale());
    return <InlineLoadError message={dict.common.somethingWentWrong} />;
  }

  const { locale, currencyCode, data } = loaded;
  const dict = getDictionary(locale);
  const intlLocale = locale === "th" ? "th-TH" : "en-US";
  // Same user-calendar "today" the loader measured to. monthDate is UTC
  // midnight of the 1st, so it's formatted in UTC to keep the month exact.
  const { daysLeft, monthDate } = getMonthProgress(data.today);
  const monthFormat = (month: "long" | "short") =>
    new Intl.DateTimeFormat(intlLocale, { month, timeZone: "UTC" }).format(monthDate);

  return (
    <IncomeThisMonthCard
      summary={data.summary}
      daysLeft={daysLeft}
      currencyCode={currencyCode}
      labels={{
        ...dict.homeIncome,
        title: dict.homeIncome.title.replace("{month}", monthFormat("long")),
        monthShort: monthFormat("short"),
        daysLeft: dict.dashboard.daysLeft,
      }}
    />
  );
}
