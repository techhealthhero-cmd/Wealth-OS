import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { logNav } from "@/lib/dev-diagnostics";
import { OnboardingForm } from "@/features/profile/components/onboarding-form";
import { Artwork } from "@/components/shared/artwork";

export const metadata: Metadata = { title: "Welcome — Wealth OS" };

export default async function OnboardingPage() {
  const profile = await getProfile();

  if (!profile) {
    logNav({ from: "/onboarding", to: "/login", reason: "no profile row", source: "onboarding/page.tsx" });
    redirect("/login");
  }

  if (profile.onboarding_completed) {
    logNav({ from: "/onboarding", to: "/dashboard", reason: "onboarding already completed", source: "onboarding/page.tsx" });
    redirect("/dashboard");
  }

  // `/onboarding` lives outside the `(app)` route group, so it doesn't
  // inherit that layout's `I18nProvider` — `OnboardingForm`'s `useTranslation()`
  // calls would otherwise throw "must be used within an I18nProvider" and
  // crash this page for every brand-new user (caught via live browser QA,
  // not typecheck/build — a client-only runtime context error). Mirrors
  // `(app)/layout.tsx`'s own locale/dictionary setup.
  const locale = await getLocale(profile.preferred_language);
  const dict = getDictionary(locale);

  return (
    <I18nProvider locale={locale} dict={dict}>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-4 py-12">
        <Artwork
          src="/artwork/brand/planner-cutout.webp"
          square
          priority
          className="w-36 drop-shadow-[0_8px_12px_rgba(30,18,6,0.22)] sm:w-40"
        />
        <div className="w-full max-w-md">
          <OnboardingForm defaultDisplayName={profile.display_name} />
        </div>
      </div>
    </I18nProvider>
  );
}
