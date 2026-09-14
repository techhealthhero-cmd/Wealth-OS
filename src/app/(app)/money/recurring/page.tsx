import type { Metadata } from "next";

import { getUpcomingBills } from "@/features/recurring/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { UpcomingBillsCard } from "@/features/recurring/components/upcoming-bills-card";
import { RecurringTransactionList } from "@/features/recurring/components/recurring-transaction-list";

export const metadata: Metadata = { title: "Recurring — Wealth OS" };

export default async function MoneyRecurringPage() {
  const [bills, profile] = await Promise.all([getUpcomingBills(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="space-y-6">
      <UpcomingBillsCard bills={bills} dict={dict} />
      <RecurringTransactionList />
    </div>
  );
}
