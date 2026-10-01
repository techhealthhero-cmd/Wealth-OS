import Link from "next/link";
import { ArrowRight, Compass, Plus, Sparkles, Trophy, Wallet } from "lucide-react";

import { getEarnHubData } from "@/features/earn/v2-queries";
import { getIncomeProfileSummary } from "@/features/income-profile/queries";
import { getIncomeTarget } from "@/features/income-target/queries";
import { parseMoneyToCents } from "@/lib/financial/money";
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
  RoadmapFocusCard,
} from "./hub-cards";
import { localizeMission } from "./helpers";

/**
 * Earn Hub — the answer to "ตอนนี้ฉันควรทำอะไรต่อ?".
 * Hierarchy (spec): situation → ONE next action (strongest) → income
 * progress → active paths → supporting (skills/rank). The core guidance
 * loop is never paywalled or hidden by Privacy Center — only money amounts
 * respect the "planning" privacy scope.
 */
export async function EarnHub() {
  const [data, profile, privacy, incomeSummary, target] = await Promise.all([
    getEarnHubData(),
    getProfile(),
    getAccountPrivacyState(),
    // Supporting numbers only — a failure here must never hide the guidance.
    getIncomeProfileSummary().catch(() => null),
    getIncomeTarget().catch(() => null),
  ]);
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  const v2 = dict.earn.v2;

  if (!data.assessment && data.paths.length === 0) return <EarnIntro dict={dict} />;

  const amountsHidden = isPrivacyLockedFor(privacy, "planning");
  const livePaths = data.paths.filter((p) => p.path.status !== "archived");
  const focusPath =
    livePaths.find((item) => item.path.id === data.nextAction.primary.pathId) ??
    livePaths.find((item) => item.path.status === "active") ??
    livePaths[0];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <EarnSituationCard dict={dict} stage={data.stage} />

      <NextActionCard
        dict={dict}
        primary={data.nextAction.primary}
        secondary={data.nextAction.secondary}
        missionTitles={Object.fromEntries(
          Object.entries(data.missionRefs).map(([id, r]) => [
            id,
            localizeMission(dict, r.pathType, { title: r.title, roadmap_step_key: r.stepKey, income_path_id: id }).title,
          ])
        )}
        contextLabel={focusPath?.path.title}
      />

      {/* Hidden (not an error message) until migration 0031 provides income links. */}
      {data.income.available ? (
        <IncomeProgressCard
          dict={dict}
          income={data.income}
          privacy={privacy}
          hidden={amountsHidden}
          averageMonthlyCents={incomeSummary?.profile.averageMonthlyIncomeCents ?? null}
          targetMonthlyCents={target?.target_monthly_income ? parseMoneyToCents(target.target_monthly_income) : null}
        />
      ) : null}

      <section aria-labelledby="earn-paths" className="space-y-3">
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
          <div className="grid gap-3 sm:grid-cols-2">
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

      {focusPath ? <RoadmapFocusCard dict={dict} item={focusPath} /> : null}

      <section aria-labelledby="earn-supporting" className="space-y-3">
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
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-2 text-center text-xs font-medium shadow-xs transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <l.icon className="size-5 text-primary dark:text-[#7FD6B2]" aria-hidden="true" />
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
    <Card className="mx-auto max-w-2xl overflow-hidden rounded-[2rem] border-primary/10 bg-linear-to-b from-primary/6 via-card to-card shadow-[0_18px_48px_-34px_color-mix(in_oklab,var(--primary)_55%,transparent)]">
      <CardContent className="flex flex-col items-center gap-5 px-5 pb-7 pt-8 text-center sm:px-10 sm:pb-10 sm:pt-10">
        <div className="rounded-[2rem] bg-primary/6 p-3 ring-1 ring-primary/10">
          <EarnIllustration size={136} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">{v2.intro.eyebrow}</p>
          <h2 className="text-2xl font-bold leading-tight text-balance sm:text-3xl">{v2.intro.title}</h2>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">{v2.intro.body}</p>
        </div>
        <Button className="h-12 w-full max-w-md rounded-2xl text-base shadow-sm" nativeButton={false} render={<Link href="/earn/diagnostic" />}>
          {v2.intro.start}
          <ArrowRight className="ml-1 size-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" className="h-11 w-full max-w-md rounded-2xl" nativeButton={false} render={<Link href="/earn/paths/new" />}>
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
