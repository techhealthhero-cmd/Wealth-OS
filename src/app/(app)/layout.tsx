import { redirect } from "next/navigation";

import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const locale = await getLocale(profile.preferred_language);
  const dict = getDictionary(locale);

  return (
    <I18nProvider locale={locale} dict={dict}>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header displayName={profile.display_name} />
          <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8">{children}</main>
          <BottomNav />
        </div>
      </div>
      <Toaster position="top-center" />
    </I18nProvider>
  );
}
