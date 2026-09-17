import { BrandMark } from "@/components/illustrations";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";

// `(auth)` lives outside the `(app)` route group, so it doesn't inherit
// that layout's `I18nProvider` — every form under here (`login`, `signup`,
// `forgot-password`, `reset-password`) calls `useTranslation()`, which
// throws "must be used within an I18nProvider" without this. No signed-in
// user/profile exists yet at this point, so `getLocale()` falls back to the
// locale cookie or the Thai default — same pattern as `/onboarding`.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <I18nProvider locale={locale} dict={dict}>
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center justify-center gap-2 text-lg font-semibold text-primary">
            <BrandMark size={24} />
            <span className="text-foreground">Wealth OS</span>
          </div>
          {children}
        </div>
      </div>
    </I18nProvider>
  );
}
