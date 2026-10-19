import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { MoneyChrome } from "@/components/layout/money-chrome";

export default async function MoneyLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return <MoneyChrome title={dict.nav.money}>{children}</MoneyChrome>;
}
