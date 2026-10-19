import { BrandMark } from "@/components/illustrations";
import { Artwork } from "@/components/shared/artwork";
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
          {/* The transparent closed-journal cut-out, same as the landing page,
              onboarding and the iOS launch image, so launch -> sign-in reads
              as one scene. (preview.webp is an opaque painted tile with a
              coral background and rough white corners; clipped by
              rounded-2xl it looked pasted on top of the cream page.) */}
          <Artwork
            src="/artwork/brand/planner-cutout.webp"
            square
            priority
            className="mx-auto w-28 drop-shadow-[0_8px_12px_rgba(30,18,6,0.22)]"
          />
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
