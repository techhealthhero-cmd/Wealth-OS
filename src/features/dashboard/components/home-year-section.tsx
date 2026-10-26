import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { captureError } from "@/lib/observability";
import { InlineLoadError } from "@/components/shared/inline-load-error";
import { loadHomeYear } from "../home-year-data";
import { HomeYearView } from "./home-year-view";

export async function HomeYearSection({
  today,
  yearParam,
  locale,
  currencyCode,
}: {
  today: string;
  yearParam?: string;
  locale: Locale;
  currencyCode: string;
}) {
  const dict = getDictionary(locale);
  const data = await loadHomeYearSafe({
    today,
    yearParam,
    locale,
    uncategorized: dict.homeYear.uncategorized,
    other: dict.homeYear.other,
  });
  if (!data) return <InlineLoadError message={dict.common.somethingWentWrong} />;
  return <HomeYearView labels={dict.homeYear} locale={locale} currencyCode={currencyCode} {...data} />;
}

async function loadHomeYearSafe(input: Parameters<typeof loadHomeYear>[0]) {
  try {
    return await loadHomeYear(input);
  } catch (error) {
    captureError(error, { route: "dashboard.HomeYearSection", operation: "load_home_year" });
    return null;
  }
}
