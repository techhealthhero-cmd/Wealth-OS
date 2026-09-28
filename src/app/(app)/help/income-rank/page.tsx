import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Layers3,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { INCOME_MISSION_XP_REWARDS, INCOME_RANKS } from "@/lib/skills/income-rank";
import type { MissionType } from "@/types/database";

export const metadata: Metadata = { title: "Income XP & Rank Guide — Wealth OS" };

const MISSION_REWARDS = Object.entries(INCOME_MISSION_XP_REWARDS) as [MissionType, number][];

export default async function IncomeRankGuidePage() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);
  const guide = dict.incomeRankGuide;

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-28">
      <Button nativeButton={false} render={<Link href="/profile" />} variant="ghost" className="-ml-2">
        <ArrowLeft aria-hidden="true" />
        {guide.backToSettings}
      </Button>

      <div className="relative overflow-hidden rounded-2xl bg-primary px-5 py-6 text-primary-foreground shadow-card">
        <div className="absolute -right-8 -top-10 size-36 rounded-full bg-white/8" aria-hidden="true" />
        <div className="absolute -bottom-12 right-16 size-28 rounded-full bg-white/5" aria-hidden="true" />
        <div className="relative space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/12">
            <Trophy className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium tracking-wide text-primary-foreground/70 uppercase">{guide.eyebrow}</p>
            <h1 className="font-heading text-2xl font-bold text-balance">{guide.title}</h1>
            <p className="max-w-xl text-sm leading-relaxed text-primary-foreground/75">{guide.subtitle}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{guide.overviewTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-secondary p-4">
            <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Award className="size-4" aria-hidden="true" />
            </div>
            <p className="font-heading font-semibold">{guide.rankConceptTitle}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.rankConceptDescription}</p>
          </div>
          <div className="rounded-xl bg-muted/70 p-4">
            <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-background text-foreground shadow-sm">
              <Layers3 className="size-4" aria-hidden="true" />
            </div>
            <p className="font-heading font-semibold">{guide.skillConceptTitle}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.skillConceptDescription}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{guide.xpRulesTitle}</CardTitle>
          <CardDescription>{guide.xpRulesDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {guide.xpRules.map((rule, index) => (
            <div key={rule.title} className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-sm font-semibold text-primary">
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className="font-medium">{rule.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{rule.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{guide.missionXpTitle}</CardTitle>
          <CardDescription>{guide.missionXpDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {MISSION_REWARDS.map(([missionType, xp]) => (
            <div key={missionType} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
              <span className="min-w-0 text-sm font-medium">{dict.earn.missions.templates[missionType].title}</span>
              <Badge className="shrink-0 font-mono tabular-nums">+{xp} {guide.xpUnit}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{guide.rankRoadmapTitle}</CardTitle>
          <CardDescription>{guide.rankRoadmapDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {INCOME_RANKS.map((rank, index) => (
            <div key={rank.rank} className="flex items-center gap-3 rounded-xl bg-muted/55 px-3 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary font-mono text-sm font-bold text-primary-foreground">
                {String(rank.rank).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{dict.earn.skills.rankTitles[rank.titleKey]}</p>
                <p className="text-xs text-muted-foreground">{guide.startsAt.replace("{xp}", rank.minimumXp.toLocaleString(locale))}</p>
              </div>
              {index < INCOME_RANKS.length - 1 ? (
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card variant="soft">
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-heading font-semibold">{guide.protectionTitle}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.protectionDescription}</p>
            </div>
          </div>
          <div className="flex gap-3 border-t border-primary/10 pt-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-medium">{guide.tipTitle}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.tipDescription}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button nativeButton={false} render={<Link href="/earn/skills" />} size="lg" className="w-full">
        {guide.viewRank}
        <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  );
}
