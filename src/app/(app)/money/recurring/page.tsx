import type { Metadata } from "next";
import { Suspense } from "react";

import { getPaymentCalendarSources, getUpcomingBills, PAID_LOOKBACK_MONTHS } from "@/features/recurring/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { todayInTimeZone } from "@/lib/date";
import { shiftMonth } from "@/lib/financial/payment-calendar";
import { captureError } from "@/lib/observability";
import { PaymentCalendar } from "@/features/recurring/components/payment-calendar";
import { DetectedSubscriptionsLink, UpcomingPaymentsList } from "@/features/recurring/components/upcoming-payments-list";
import { RecurringTransactionList } from "@/features/recurring/components/recurring-transaction-list";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";
import { InlineLoadError } from "@/components/shared/inline-load-error";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Recurring — Wealth OS" };

export default async function MoneyRecurringPage() {
  const privacyGate = await getPrivacyGate("activity");
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  // Calendar → month total → upcoming (replaces the old UpcomingBillsCard)
  // → pointer to detected subscriptions → the full recurring list. The
  // calendar section loads (and fails) on its own, so the list always renders.
  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-[20px]" />}>
        <PaymentCalendarSection
          timezone={profile?.timezone ?? "Asia/Bangkok"}
          locale={locale}
          currencyCode={profile?.currency_code ?? "THB"}
          dict={dict}
        />
      </Suspense>
      <DetectedSubscriptionsLink hint={dict.paymentCalendar.detectedHint} tabTitle={dict.subscriptions.title} />
      <RecurringTransactionList />
    </div>
  );
}

async function PaymentCalendarSection({
  timezone,
  locale,
  currencyCode,
  dict,
}: {
  timezone: string;
  locale: "th" | "en";
  currencyCode: string;
  dict: ReturnType<typeof getDictionary>;
}) {
  const today = todayInTimeZone(timezone);
  let loaded;
  try {
    const [bills, sources] = await Promise.all([getUpcomingBills(), getPaymentCalendarSources(today)]);
    loaded = { bills, sources };
  } catch (error) {
    captureError(error, { route: "money.recurring.PaymentCalendar", operation: "load_payment_calendar" });
    return <InlineLoadError message={dict.common.somethingWentWrong} />;
  }

  return (
    <div className="space-y-4">
      <PaymentCalendar
        sources={loaded.sources}
        today={today}
        locale={locale}
        currencyCode={currencyCode}
        minMonth={shiftMonth(today.slice(0, 7), -PAID_LOOKBACK_MONTHS)}
        labels={dict.paymentCalendar}
      />
      <UpcomingPaymentsList
        bills={loaded.bills}
        today={today}
        locale={locale}
        currencyCode={currencyCode}
        labels={{ ...dict.upcomingBills, calendar: dict.paymentCalendar }}
      />
    </div>
  );
}
