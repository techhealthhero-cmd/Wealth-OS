import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getProfile } from "@/features/profile/queries";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ChevronRight, Compass } from "lucide-react";

export const metadata: Metadata = { title: "Profile — Wealth OS" };

export default async function ProfilePage() {
  // getEntitlements() doesn't depend on profile (it resolves the plan from
  // the session directly) — perf audit finding: these were sequential for
  // no reason. Safe to run before the profile-null check: the parent
  // (app)/layout.tsx already redirects unauthenticated users before this
  // page renders at all, so `!profile` here is a rare defensive case, not
  // the normal signed-out path.
  const [profile, entitlements] = await Promise.all([getProfile(), getEntitlements()]);
  if (!profile) redirect("/login");

  const locale = await getLocale(profile.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-lg space-y-4">
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

      <ProfileForm profile={profile} />
    </div>
  );
}
