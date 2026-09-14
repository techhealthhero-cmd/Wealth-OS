import { getDetectedSubscriptions } from "@/features/subscriptions/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { SubscriptionCard } from "./subscription-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyTransactionsIllustration } from "@/components/illustrations";

export async function SubscriptionList() {
  const [subscriptions, profile] = await Promise.all([getDetectedSubscriptions(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (subscriptions.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyTransactionsIllustration size={140} />}
        title={dict.subscriptions.emptyTitle}
        description={dict.subscriptions.emptyState}
      />
    );
  }

  return (
    <div className="grid gap-3">
      {subscriptions.map((s) => (
        <SubscriptionCard key={s.id} subscription={s} />
      ))}
    </div>
  );
}
