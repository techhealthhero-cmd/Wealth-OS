import { getAssets } from "@/features/assets/queries";
import { getAccounts } from "@/features/accounts/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { AssetForm } from "./asset-form";
import { AssetCard } from "./asset-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyAccountsIllustration } from "@/components/illustrations";

export async function AssetList() {
  const [assets, accounts, profile] = await Promise.all([getAssets(), getAccounts(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

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
      <div className="flex justify-end">
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
