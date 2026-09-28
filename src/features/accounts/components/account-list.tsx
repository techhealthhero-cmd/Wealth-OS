import { getAccounts } from "@/features/accounts/queries";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";
import { getAccountPrivacyState } from "@/features/account-privacy/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { AccountCard } from "./account-card";
import { SortableAccountList } from "./sortable-account-list";
import { AccountForm } from "./account-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyAccountsIllustration } from "@/components/illustrations";
import { Plus } from "lucide-react";

export async function AccountList() {
  const [profile, privacy] = await Promise.all([
    getProfile(),
    getAccountPrivacyState(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  // Do not fetch account rows at all while privacy mode is locked. This is
  // intentionally stronger than visually blurring real values: names and
  // balances are absent from the rendered payload and browser DOM.
  if (privacy.enabled && !privacy.isUnlocked) {
    return <AccountPrivacyPlaceholder privacy={privacy} copy={dict.accountPrivacy} />;
  }

  const allAccounts = await getAccounts({ includeArchived: true });

  const activeAccounts = allAccounts.filter((a) => !a.is_archived);
  const archivedAccounts = allAccounts.filter((a) => a.is_archived);

  if (activeAccounts.length === 0 && archivedAccounts.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyAccountsIllustration size={140} />}
        title={dict.accounts.emptyTitle}
        description={dict.accounts.emptyState}
        action={
          <AccountForm
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {dict.accounts.addFirstAccount}
              </Button>
            }
          />
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <AccountForm />
      </div>
      {activeAccounts.length > 1 ? (
        <p className="text-xs text-muted-foreground">{dict.accounts.reorderHint}</p>
      ) : null}
      {activeAccounts.length > 0 ? <SortableAccountList accounts={activeAccounts} /> : null}
      {archivedAccounts.length > 0 ? (
        <div className="space-y-3 pt-3">
          <h2 className="text-sm font-medium text-muted-foreground">{dict.accounts.archivedAccounts}</h2>
          {/* Visually de-emphasized (see UX_GUIDELINES.md #14) — archived
              accounts shouldn't compete with active ones, but need to stay
              reachable so "Archive" is genuinely reversible, not a one-way
              delete in disguise. */}
          <div className="grid gap-3 opacity-70">
            {archivedAccounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
