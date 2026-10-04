import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getProfile } from "@/features/profile/queries";
import { getDisplayAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
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
import { MinimizableFormProvider, MinimizableFormHost } from "@/components/shared/minimizable-form-context";

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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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

  // Fetched here (not inside BottomNav itself, a Client Component) so the
  // nav's new permanent center "+" can open the same expense/income/
  // transfer dialogs QuickAdd already uses elsewhere — both cached via
  // React's `cache()` (see those queries' own doc comments), so a page that
  // also calls them with the same arguments (e.g. dashboard's display-safe
  // account query)
  // with no options) dedupes against this call instead of re-querying.
  const [locale, accounts, categories, companionState] = await Promise.all([
    getLocale(profile.preferred_language),
    getDisplayAccounts(),
    getCategories(),
    getCompanionState(),
  ]);
  const companion = {
    id: companionState.active.id,
    image: companionState.active.image,
    emoji: companionState.active.emoji,
    theme: companionState.active.theme,
    focus: companionState.active.focus,
    presence: companionState.presence,
  };
  const dict = getDictionary(locale);

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
            <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-8">
              <PullToRefresh>{children}</PullToRefresh>
            </main>
            <BottomNav accounts={accounts} categories={categories} />
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
          className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[calc(env(safe-area-inset-top)+14px)] bg-gradient-to-b from-background via-background/70 to-transparent backdrop-blur-[6px] [-webkit-mask-image:linear-gradient(to_bottom,black_55%,transparent)] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] md:hidden"
        />
        <MinimizableFormHost />
        <FloatingAiButton companion={companion} />
      </MinimizableFormProvider>
      <Toaster position="top-center" />
    </I18nProvider>
  );
}
