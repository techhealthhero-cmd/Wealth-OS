import Link from "next/link";
import { GitCompareArrows, Lock } from "lucide-react";

import { canUseFeature, FEATURES } from "@/lib/billing/entitlements";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { Button } from "@/components/ui/button";

/**
 * Plus+-only entry point to /plan/money-year/compare (see billing/plans.ts
 * MONEY_YEAR_COMPARE). Same "never a dead button" pattern as
 * export-button.tsx: an entitled user gets a real link to the comparison
 * page; a non-entitled one gets a real link to /pricing instead of a
 * disabled no-op.
 */
export async function CompareYearsButton() {
  const [profile, canCompare] = await Promise.all([getProfile(), canUseFeature(FEATURES.MONEY_YEAR_COMPARE)]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (canCompare) {
    return (
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/plan/money-year/compare" />}>
        <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
        {dict.moneyYear.compareYears}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      render={<Link href="/pricing" />}
      title={dict.billing.locked.moneyYearCompareDescription}
    >
      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
      {dict.moneyYear.compareYears}
    </Button>
  );
}
