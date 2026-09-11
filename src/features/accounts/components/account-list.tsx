import { getAccounts } from "@/features/accounts/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { AccountCard } from "./account-card";
import { AccountForm } from "./account-form";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyAccountsIllustration } from "@/components/illustrations";

export async function AccountList() {
  const [accounts, profile] = await Promise.all([getAccounts(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (accounts.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyAccountsIllustration size={140} />}
        title={dict.accounts.emptyTitle}
        description={dict.accounts.emptyState}
        action={<AccountForm />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <AccountForm />
      </div>
      <div className="grid gap-3">
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>
    </div>
  );
}
