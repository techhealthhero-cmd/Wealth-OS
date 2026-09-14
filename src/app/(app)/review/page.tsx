import type { Metadata } from "next";

import { buildMonthlyReviewSnapshot, getMonthlyReview } from "@/features/monthly-review/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { MonthlyReviewView } from "@/features/monthly-review/components/monthly-review-view";

export const metadata: Metadata = { title: "Monthly Review — Wealth OS" };

export default async function ReviewPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [snapshot, existing, profile] = await Promise.all([
    buildMonthlyReviewSnapshot(year, month),
    getMonthlyReview(year, month),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">{dict.monthlyReview.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.monthlyReview.subtitle}</p>
      </div>
      <MonthlyReviewView year={year} month={month} snapshot={snapshot} existing={existing} />
    </div>
  );
}
