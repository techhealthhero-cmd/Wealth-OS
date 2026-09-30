import Link from "next/link";
import { ArrowRight, Compass, Plus, Sparkles, Trophy, Wallet } from "lucide-react";

import { getEarnHubData } from "@/features/earn/v2-queries";
import { getProfile } from "@/features/profile/queries";
import { getAccountPrivacyState } from "@/features/account-privacy/queries";
import { isPrivacyLockedFor } from "@/features/account-privacy/types";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconChip } from "@/components/shared/icon-chip";
import { EarnIllustration } from "@/components/illustrations";
import {
  EarnSituationCard,
  IncomePathCard,
  IncomeProgressCard,
  NextActionCard,
  RecommendedExperimentCard,
} from "./hub-cards";

/**
 * Earn Hub — the answer to "ตอนนี้ฉันควรทำอะไรต่อ?".
 * Hierarchy (spec): situation → ONE next action (strongest) → income
 * progress → active paths → supporting (skills/rank). The core guidance
 * loop is never paywalled or hidden by Privacy Center — only money amounts
 * respect the "planning" privacy scope.
 */
export async function EarnHub() {
  const [data, profile, privacy] = await Promise.all([getEarnHubData(), getProfile(), getAccountPrivacyState()]);
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  const v2 = dict.earn.v2;

  if (!data.assessment && data.paths.length === 0) return <EarnIntro dict={dict} />;

  const amountsHidden = isPrivacyLockedFor(privacy, "planning");
  const livePaths = data.paths.filter((p) => p.path.status !== "archived");

  return (
    <div className="space-y-4">
      <EarnSituationCard dict={dict} stage={data.stage} />

      <NextActionCard
        dict={dict}
        primary={data.nextAction.primary}
        secondary={data.nextAction.secondary}
        missionTitles={data.missionTitles}
      />

      {livePaths.length > 0 ? <IncomeProgressCard dict={dict} income={data.income} hidden={amountsHidden} /> : null}

      <section aria-labelledby="earn-paths" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="earn-paths" className="text-base font-semibold">
            {livePaths.length > 0 ? v2.hub.activePaths : v2.hub.recommended}
          </h2>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/earn/paths/new" />}>
            <Plus className="mr-1 size-3.5" aria-hidden="true" />
            {v2.paths.new}
          </Button>
        </div>
        {livePaths.length > 0 ? (
          <div className="space-y-2">
            {livePaths.map((item) => (
              <IncomePathCard key={item.path.id} dict={dict} item={item} />
            ))}
          </div>
        ) : data.recommendations.length > 0 ? (
          <div className="space-y-2">
            {data.recommendations.map((e) => (
              <RecommendedExperimentCard key={e.key} dict={dict} experiment={e} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">{v2.result.noExperiments}</CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="earn-supporting" className="space-y-2">
        <h2 id="earn-supporting" className="text-sm font-medium text-muted-foreground">
          {v2.hub.supporting}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/earn/skills", icon: Sparkles, label: v2.hub.skills },
            { href: "/earn/income", icon: Wallet, label: dict.earn.tabs.income },
            { href: "/earn/opportunities", icon: Compass, label: dict.earn.tabs.opportunities },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-2 text-center text-xs font-medium hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <l.icon className="size-5 text-primary" aria-hidden="true" />
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/** First visit: friendly intro → diagnostic, or skip straight to choosing a path. */
function EarnIntro({ dict }: { dict: ReturnType<typeof getDictionary> }) {
  const v2 = dict.earn.v2;
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-4 px-6 pb-6 pt-8 text-center">
        <EarnIllustration size={140} />
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-balance">{v2.intro.title}</h2>
          <p className="text-sm text-muted-foreground text-pretty">{v2.intro.body}</p>
        </div>
        <Button className="h-12 w-full rounded-2xl text-base" nativeButton={false} render={<Link href="/earn/diagnostic" />}>
          {v2.intro.start}
          <ArrowRight className="ml-1 size-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" className="h-11 w-full" nativeButton={false} render={<Link href="/earn/paths/new" />}>
          {v2.intro.knowPath}
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconChip icon={Trophy} tone="slate" className="size-6 [&_svg]:size-3.5" />
          {v2.intro.note}
        </p>
      </CardContent>
    </Card>
  );
}
