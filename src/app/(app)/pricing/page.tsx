import type { Metadata } from "next";

import { getEntitlements } from "@/lib/billing/entitlements";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { PricingTable } from "@/features/billing/components/pricing-table";

export const metadata: Metadata = { title: "Pricing — Wealth OS" };

export default async function PricingPage() {
  const [entitlements, profile] = await Promise.all([getEntitlements(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{dict.billing.pricing.title}</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{dict.billing.pricing.subtitle}</p>
      </div>

      <PricingTable currentPlan={entitlements.plan} dict={dict} />

      <p className="text-center text-xs text-muted-foreground">{dict.billing.pricing.disclaimer}</p>
    </div>
  );
}
