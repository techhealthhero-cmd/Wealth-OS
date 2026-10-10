import { getProfile } from "@/features/profile/queries";
import { resolveCoverPreferences } from "@/lib/notebook-covers/config";
import { HomeBook } from "@/features/notebook-cover/components/home-book";

/**
 * Home is the journal's first page: swipe to turn on to Money, or back to
 * close the cover (see HomeBook). The profile query is the same cached one
 * the (app) layout already ran.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const cover = resolveCoverPreferences(profile);
  return (
    <HomeBook prefs={{ theme: cover.theme, decorations: cover.decorations, name: cover.name }} displayName={profile?.display_name ?? null}>
      {children}
    </HomeBook>
  );
}
