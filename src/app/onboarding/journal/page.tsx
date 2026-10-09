import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { Toaster } from "@/components/ui/sonner";
import { JournalOnboarding } from "@/features/notebook-cover/components/journal-onboarding";

export const metadata: Metadata = { title: "Your journal — Wealth OS" };

/**
 * Second onboarding step: choose the journal's cover. Reached once, right
 * after the profile onboarding. Never forced on anyone afterwards — the app
 * layout doesn't redirect here, so existing users simply keep the default
 * cover and can change it in Settings.
 */
export default async function JournalOnboardingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.onboarding_completed) redirect("/onboarding");
  if (profile.cover_chosen_at) redirect("/dashboard");

  // Outside the (app) group, so set up i18n here (same as /onboarding).
  const locale = await getLocale(profile.preferred_language);
  const dict = getDictionary(locale);

  return (
    <I18nProvider locale={locale} dict={dict}>
      <main className="journal-dots min-h-dvh bg-background">
        <JournalOnboarding displayName={profile.display_name} />
      </main>
      <Toaster />
    </I18nProvider>
  );
}
