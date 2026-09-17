import { getLiabilities } from "@/features/liabilities/queries";
import { getAccounts } from "@/features/accounts/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { LiabilityForm } from "./liability-form";
import { LiabilityCard } from "./liability-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyAccountsIllustration } from "@/components/illustrations";

export async function LiabilityList() {
  const [liabilities, accounts, profile] = await Promise.all([getLiabilities(), getAccounts(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);
  // Only active credit_card accounts are offered as a link target — see
  // CLAUDE.md "LIABILITY <-> ACCOUNT LINKING" (Phase 15: "show only
  // compatible active credit-card accounts").
  const creditCardAccounts = accounts.filter((a) => a.account_type === "credit_card");

  if (liabilities.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyAccountsIllustration size={140} />}
        title={dict.liabilities.emptyTitle}
        description={dict.liabilities.emptyState}
        action={<LiabilityForm creditCardAccounts={creditCardAccounts} />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <LiabilityForm creditCardAccounts={creditCardAccounts} />
      </div>
      <div className="grid gap-3">
        {liabilities.map((liability) => (
          <LiabilityCard key={liability.id} liability={liability} creditCardAccounts={creditCardAccounts} />
        ))}
      </div>
    </div>
  );
}
