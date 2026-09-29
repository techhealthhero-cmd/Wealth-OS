import { getAssets } from "@/features/assets/queries";
import { getDisplayAccounts } from "@/features/accounts/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { AssetForm } from "./asset-form";
import { AssetCard } from "./asset-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyAccountsIllustration } from "@/components/illustrations";
import { InfoPopover } from "@/components/shared/info-popover";
import { getAccountPrivacyState } from "@/features/account-privacy/queries";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";

export async function AssetList() {
  const [profile, privacy] = await Promise.all([getProfile(), getAccountPrivacyState()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  // Match the Accounts page's fail-closed behavior: while the Assets scope
  // is protected, asset rows are not fetched or included in the RSC payload.
  if (privacy.enabled && privacy.protectAssets && !privacy.isUnlocked) {
    return <AccountPrivacyPlaceholder privacy={privacy} copy={dict.accountPrivacy} section="assets" />;
  }

  const [assets, accounts] = await Promise.all([getAssets(), getDisplayAccounts()]);

  if (assets.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyAccountsIllustration size={140} />}
        title={dict.assets.emptyTitle}
        description={dict.assets.emptyState}
        action={<AssetForm accounts={accounts} />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium">{dict.assets.title}</p>
          <InfoPopover label={dict.assets.whatIsThis} explanation={dict.assets.explanation} />
        </div>
        <AssetForm accounts={accounts} />
      </div>
      <div className="grid gap-3">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} accounts={accounts} />
        ))}
      </div>
    </div>
  );
}
