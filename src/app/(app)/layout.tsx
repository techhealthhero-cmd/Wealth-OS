import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { logNav } from "@/lib/dev-diagnostics";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { FloatingAiButton } from "@/components/layout/floating-ai-button";
import { getCompanionState } from "@/features/companions/queries";
import { Header } from "@/components/layout/header";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PlanBadge } from "@/features/billing/components/plan-badge";
import { Toaster } from "@/components/ui/sonner";
import { PullToRefresh } from "@/components/shared/pull-to-refresh";
import { JournalSectionTabs } from "@/components/layout/journal-section-tabs";
import { MinimizableFormProvider, MinimizableFormHost } from "@/components/shared/minimizable-form-context";
import { NotebookLaunch } from "@/features/notebook-cover/components/notebook-launch";
import { LaunchStill } from "@/features/notebook-cover/components/launch-still";
import { LAUNCH_COOKIE, decodeLaunchCookie } from "@/lib/notebook-covers/launch-cookie";
import { resolveCoverPreferences } from "@/lib/notebook-covers/config";
import { getLaunchVariant } from "@/lib/notebook-covers/playback";

/**
 * Day 8 STEP 11 — every page behind auth (dashboard, money, plan, earn, ai,
 * profile/billing, pricing) is noindexed: each requires a session, so a
 * search engine could never render or usefully index one anyway, and a
 * financial dashboard has no reason to appear in search results even if it
 * somehow could. `/pricing` lives in this same route group (it reuses this
 * layout's nav/auth), so it's noindexed too — a known, accepted tradeoff of
 * keeping it in the authenticated app shell rather than building a separate
 * public marketing surface for it (see PROJECT_STATUS.md Known Limitations).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Launch screen: the shell below waits on the profile query, so it sits in
 * a Suspense boundary whose fallback is the user's closed journal (read
 * from the small launch cookie, no database). That fallback is in the very
 * first bytes of the response, so a fresh launch goes launch image ->
 * closed journal -> journal opening, never through a blank white page.
 * Navigations and refreshes never show it again: the layout stays mounted.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const launch = decodeLaunchCookie((await cookies()).get(LAUNCH_COOKIE)?.value);
  const showStill = getLaunchVariant({ mode: launch.prefs.openingMode, firstPlayed: launch.firstPlayed }) !== null;
  return (
    <Suspense fallback={<LaunchStill prefs={launch.prefs} show={showStill} />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

async function AppShell({ children }: { children: React.ReactNode }) {
  // Started alongside the profile (it only needs the cached auth user), so
  // its plan + unlocked-companions queries no longer wait behind the profile
  // on every page. The no-op catch only stops an "unhandled rejection" if we
  // redirect below before awaiting it; the await still throws normally.
  const companionStatePromise = getCompanionState();
  companionStatePromise.catch(() => undefined);
  const profile = await getProfile();

  if (!profile) {
    logNav({ from: "(protected route)", to: "/login", reason: "no profile row", source: "(app)/layout.tsx" });
    redirect("/login");
  }

  if (!profile.onboarding_completed) {
    logNav({
      from: "(protected route)",
      to: "/onboarding",
      reason: "onboarding_completed=false",
      source: "(app)/layout.tsx",
    });
    redirect("/onboarding");
  }

  // Quick Capture fetches its user-scoped accounts/categories on demand.
  // Keeping those mutable rows out of this persistent layout both shortens
  // the app-shell waterfall and prevents old options surviving navigation.
  const [locale, companionState] = await Promise.all([
    getLocale(profile.preferred_language),
    companionStatePromise,
  ]);
  const companion = {
    id: companionState.active.id,
    image: companionState.active.image,
    emoji: companionState.active.emoji,
    theme: companionState.active.theme,
    focus: companionState.active.focus,
    displayName: profile.display_name,
    presence: companionState.presence,
  };
  const dict = getDictionary(locale);
  // Journal opening on a fresh launch, resolved here from the profile this
  // layout already loads (no extra query). The client component plays it at
  // most once per document; see NotebookLaunch.
  const cover = resolveCoverPreferences(profile);
  const launchVariant = getLaunchVariant({
    mode: cover.openingMode,
    firstPlayed: Boolean(profile.opening_first_played_at),
  });

  return (
    <I18nProvider locale={locale} dict={dict}>
      {/* Provider mounted here (not per-page) so a form "opened" via
          useMinimizableForm() keeps its mounted state — including plain
          uncontrolled <input defaultValue> DOM state — across in-app
          navigation: this layout stays mounted across route changes,
          only each page's own tree unmounts. See
          minimizable-form-context.tsx's doc comment for the full reasoning. */}
      <MinimizableFormProvider>
        {/* Mobile overflow fix (real-device iPhone bug, 2026-09): flex items
            default to `min-width: auto`, meaning they refuse to shrink below
            their content's intrinsic width — a wide descendant anywhere in
            `children` (e.g. a horizontally-scrollable tab bar with several
            Thai labels) could otherwise stretch this entire chain wider than
            the viewport, escaping even `main`'s own `overflow-x-hidden`
            (that only clips content overflowing main's OWN box; it doesn't
            stop main's box itself from being forced wider by flex sizing).
            `min-w-0` at every level of this row/column flex chain removes
            that failure mode at its root, instead of hiding it with a
            page-level `overflow-x-hidden` band-aid. */}
        <div className="flex min-h-screen min-w-0">
          <Sidebar />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <Header
              displayName={profile.display_name}
              actions={
                <>
                  <NotificationBell />
                  <PlanBadge />
                </>
              }
            />
            {/* WEALTH OS Journal (2026-10-08): the content area is a notebook
                page — faint ruled lines, binder rings in the left gutter
                (inside px-4, so they never cover content) and section
                divider tabs on the right edge. Decoration only. */}
            <main className="journal-page relative min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-8">
              <div aria-hidden="true" className="journal-binding" />
              <PullToRefresh>{children}</PullToRefresh>
            </main>
            <JournalSectionTabs />
            <BottomNav />
          </div>
        </div>
        {/* Outside `main` so its fixed-position pill/panel is never affected
            by any ancestor transform/overflow. */}
        {/* Top edge fade (2026-10-04, like ChatGPT's chat view): page
            content scrolling up under the status bar softly blurs and fades
            into the background instead of being cut by a hard edge — the
            same idea as BottomNav's frosted fade at the bottom. Mobile only;
            purely visual, never blocks taps. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[calc(env(safe-area-inset-top)+14px)] bg-gradient-to-b from-background via-background/95 to-transparent md:hidden"
        />
        <MinimizableFormHost />
        <FloatingAiButton companion={companion} />
      </MinimizableFormProvider>
      <Toaster position="top-center" />
      <NotebookLaunch
        variant={launchVariant}
        prefs={cover}
        displayName={profile.display_name}
        firstPlayed={Boolean(profile.opening_first_played_at)}
        isFirstTimeOpening={cover.openingMode === "first_time" && launchVariant !== null}
      />
    </I18nProvider>
  );
}
