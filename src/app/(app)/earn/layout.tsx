import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { EarnTabs } from "@/components/layout/earn-tabs";

export default async function EarnLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">{dict.nav.earn}</h1>
        <p className="text-sm text-muted-foreground">{dict.earn.subtitle}</p>
      </div>
      <EarnTabs />
      {children}
    </div>
  );
}
