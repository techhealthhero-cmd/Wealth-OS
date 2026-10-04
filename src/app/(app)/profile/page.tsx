import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getProfile } from "@/features/profile/queries";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getCompanionState } from "@/features/companions/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AiFabSettingsCard } from "@/components/layout/ai-fab-settings-card";
import { AccountPrivacySettingsCard } from "@/features/account-privacy/components/account-privacy-settings-card";
import { getAccountPrivacyState } from "@/features/account-privacy/queries";
import { BookOpenCheck, ChevronRight, Compass } from "lucide-react";

export const metadata: Metadata = { title: "Profile — Wealth OS" };

export default async function ProfilePage() {
  // getEntitlements() doesn't depend on profile (it resolves the plan from
  // the session directly) — perf audit finding: these were sequential for
  // no reason. Safe to run before the profile-null check: the parent
  // (app)/layout.tsx already redirects unauthenticated users before this
  // page renders at all, so `!profile` here is a rare defensive case, not
  // the normal signed-out path.
  const [profile, entitlements, companion] = await Promise.all([
    getProfile(),
    getEntitlements(),
    getCompanionState(),
  ]);
  if (!profile) redirect("/login");
  const accountPrivacy = await getAccountPrivacyState();

  const locale = await getLocale(profile.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-28">
      {/* STEP 13: a compact Billing summary lives here, linking to the full
          /billing page for management — kept as a summary + link rather
          than duplicating BillingStatusCard's full detail on this page. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.billing.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href="/billing" />}
            variant="ghost"
            className="w-full justify-between px-0 hover:bg-transparent"
          >
            <span className="flex items-center gap-2">
              {dict.billing.currentPlan}
              <Badge variant={entitlements.plan === "free" ? "outline" : "default"}>{entitlements.definition.displayName}</Badge>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href="/companions" />}
            variant="ghost"
            className="h-auto w-full justify-between px-0 py-1 hover:bg-transparent"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Image
                src={companion.active.image}
                alt=""
                width={44}
                height={44}
                className="size-11 shrink-0 rounded-full object-cover"
              />
              <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold">{dict.companions.navLabel}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {dict.companions.names[companion.active.id as keyof typeof dict.companions.names]}
                </span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.help.navLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href="/help" />}
            variant="ghost"
            className="w-full justify-between px-0 hover:bg-transparent"
          >
            <span className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {dict.help.title}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>

      <Card variant="soft">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">{dict.incomeRankGuide.settingsTitle}</CardTitle>
              <CardDescription>{dict.incomeRankGuide.settingsDescription}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href="/help/income-rank" />}
            variant="outline"
            className="w-full justify-between bg-card"
          >
            {dict.incomeRankGuide.openGuide}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>

      <AccountPrivacySettingsCard privacy={accountPrivacy} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.theme.toggle}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {dict.theme.dark} / {dict.theme.light}
          </span>
          <ThemeToggle />
        </CardContent>
      </Card>

      <AiFabSettingsCard />

      <ProfileForm profile={profile} />
    </div>
  );
}
