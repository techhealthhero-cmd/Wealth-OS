import { captureError } from "@/lib/observability";
import { getPaymentCalendarSources } from "@/features/recurring/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { todayInTimeZone } from "@/lib/date";
import { buildMonthPayments, nextPayments, summarizeMonthPayments } from "@/lib/financial/payment-calendar";
import { intlLocale } from "@/features/recurring/lib/payment-display";
import { InlineLoadError } from "@/components/shared/inline-load-error";
import { UpNextPaymentsCard, type UpNextPaymentsCardProps } from "./up-next-payments-card";

/** Next payment + the two after it. */
const NEXT_COUNT = 3;

async function loadUpNext(): Promise<UpNextPaymentsCardProps | null> {
  try {
    const profile = await getProfile();
    const today = todayInTimeZone(profile?.timezone ?? "Asia/Bangkok");
    const locale = await getLocale(profile?.preferred_language);
    const sources = await getPaymentCalendarSources(today);
    const [y, m] = today.split("-").map(Number);
    return {
      next: nextPayments(sources, NEXT_COUNT),
      month: summarizeMonthPayments(buildMonthPayments(sources, today.slice(0, 7))),
      monthLabel: new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1))),
      today,
      locale,
      currencyCode: profile?.currency_code ?? "THB",
      labels: getDictionary(locale).paymentCalendar,
    };
  } catch (error) {
    captureError(error, { route: "dashboard.UpNextPayments", operation: "load_up_next_payments" });
    return null;
  }
}

/** Home's "Up next" payments card (recurring items + liability due dates). */
export async function UpNextPayments() {
  const props = await loadUpNext();
  if (!props) {
    const dict = getDictionary(await getLocale());
    return <InlineLoadError message={dict.common.somethingWentWrong} />;
  }
  return <UpNextPaymentsCard {...props} />;
}
