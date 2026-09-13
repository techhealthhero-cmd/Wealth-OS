import { getIncomeProfileSummary } from "@/features/income-profile/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { IncomeSourceForm } from "./income-source-form";
import { IncomeSourceCard } from "./income-source-card";
import { IncomeProfileCard } from "@/features/income-profile/components/income-profile-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";

export async function IncomeSourceList() {
  const [{ profile, sources }, appProfile] = await Promise.all([getIncomeProfileSummary(), getProfile()]);
  const locale = await getLocale(appProfile?.preferred_language);
  const dict = getDictionary(locale);

  if (sources.length === 0) {
    return (
      <EmptyState
        illustration={<EarnIllustration size={140} />}
        title={dict.earn.income.emptyTitle}
        description={dict.earn.income.emptyState}
        action={<IncomeSourceForm />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <IncomeProfileCard profile={profile} />
      <div className="flex justify-end">
        <IncomeSourceForm />
      </div>
      <div className="grid gap-3">
        {sources.map((source) => (
          <IncomeSourceCard key={source.id} source={source} />
        ))}
      </div>
    </div>
  );
}
