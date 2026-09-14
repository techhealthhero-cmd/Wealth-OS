import type { Metadata } from "next";

import { buildMonthlyReviewSnapshot, getMonthlyReview } from "@/features/monthly-review/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { MonthlyReviewView } from "@/features/monthly-review/components/monthly-review-view";
import { requireFeature, FEATURES } from "@/lib/billing/entitlements";
import { LockedFeatureCard } from "@/features/billing/components/locked-feature-card";

export const metadata: Metadata = { title: "Monthly Review — Wealth OS" };

export default async function ReviewPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const gate = await requireFeature(FEATURES.MONTHLY_REVIEW);
  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <LockedFeatureCard
          title={dict.billing.locked.monthlyReviewTitle}
          description={dict.billing.locked.monthlyReviewDescription}
          ctaLabel={dict.billing.upgradeCta}
        />
      </div>
    );
  }

  const [snapshot, existing] = await Promise.all([buildMonthlyReviewSnapshot(year, month), getMonthlyReview(year, month)]);

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
