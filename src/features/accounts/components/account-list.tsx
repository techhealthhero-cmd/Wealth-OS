import { getAccounts } from "@/features/accounts/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { AccountCard } from "./account-card";
import { AccountForm } from "./account-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyAccountsIllustration } from "@/components/illustrations";
import { Plus } from "lucide-react";

export async function AccountList() {
  const [allAccounts, profile] = await Promise.all([
    getAccounts({ includeArchived: true }),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

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
      {activeAccounts.length > 0 ? (
        <div className="grid gap-3">
          {activeAccounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      ) : null}
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
