import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { resolveCoverPreferences } from "@/lib/notebook-covers/config";
import { CoverSettings } from "@/features/notebook-cover/components/cover-settings";

export const metadata: Metadata = { title: "Theme & cover — Wealth OS" };

/** Settings → ธีมและหน้าปก (notebook cover, sticker, name, opening animation). */
export default async function CoverSettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const dict = getDictionary(await getLocale(profile.preferred_language));

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-28">
      <header className="space-y-1">
        <Link
          href="/profile"
          className="-ml-1 inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {dict.notebookCover.back}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-balance">{dict.notebookCover.settingsTitle}</h1>
        <p className="text-sm text-muted-foreground">{dict.notebookCover.settingsPageSubtitle}</p>
      </header>
      <CoverSettings initial={resolveCoverPreferences(profile)} displayName={profile.display_name} />
    </div>
  );
}
