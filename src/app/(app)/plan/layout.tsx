import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { PlanTabs } from "@/components/layout/plan-tabs";

export default async function PlanLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">{dict.nav.plan}</h1>
        <p className="text-sm text-muted-foreground">{dict.plan.subtitle}</p>
      </div>
      <PlanTabs />
      {children}
    </div>
  );
}
