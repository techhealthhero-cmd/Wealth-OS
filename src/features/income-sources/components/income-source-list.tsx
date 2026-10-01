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
      <details className="group rounded-2xl border bg-card px-4">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-medium">
          <span>{dict.earn.income.title} · {sources.length}</span>
          <span className="text-xs text-muted-foreground group-open:hidden">+</span>
        </summary>
        <div className="space-y-3 border-t pb-4 pt-3">
          <div className="flex justify-end"><IncomeSourceForm /></div>
          <div className="grid gap-3">
            {sources.map((source) => <IncomeSourceCard key={source.id} source={source} />)}
          </div>
        </div>
      </details>
    </div>
  );
}
