import type { Metadata } from "next";

import { SubscriptionList } from "@/features/subscriptions/components/subscription-list";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { requireFeature, FEATURES } from "@/lib/billing/entitlements";
import { LockedFeatureCard } from "@/features/billing/components/locked-feature-card";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";

export const metadata: Metadata = { title: "Subscriptions — Wealth OS" };

export default async function MoneySubscriptionsPage() {
  const privacyGate = await getPrivacyGate("activity");
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  const gate = await requireFeature(FEATURES.SUBSCRIPTION_DETECTOR);
  if (!gate.allowed) {
    const profile = await getProfile();
    const locale = await getLocale(profile?.preferred_language);
    const dict = getDictionary(locale);
    return (
      <div className="mx-auto max-w-lg py-8">
        <LockedFeatureCard
          title={dict.billing.locked.subscriptionDetectorTitle}
          description={dict.billing.locked.subscriptionDetectorDescription}
          ctaLabel={dict.billing.upgradeCta}
        />
      </div>
    );
  }

  return <SubscriptionList />;
}
