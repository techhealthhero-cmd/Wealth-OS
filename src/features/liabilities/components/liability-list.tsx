import { getLiabilities } from "@/features/liabilities/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { LiabilityForm } from "./liability-form";
import { LiabilityCard } from "./liability-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyAccountsIllustration } from "@/components/illustrations";

export async function LiabilityList() {
  const [liabilities, profile] = await Promise.all([getLiabilities(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (liabilities.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyAccountsIllustration size={140} />}
        title={dict.liabilities.emptyTitle}
        description={dict.liabilities.emptyState}
        action={<LiabilityForm />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <LiabilityForm />
      </div>
      <div className="grid gap-3">
        {liabilities.map((liability) => (
          <LiabilityCard key={liability.id} liability={liability} />
        ))}
      </div>
    </div>
  );
}
