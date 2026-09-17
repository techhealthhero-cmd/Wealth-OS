import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WelcomeIllustration } from "@/components/illustrations";

export const metadata: Metadata = { title: "Help — Wealth OS" };

export default async function HelpPage() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);
  const help = dict.help;

  const philosophySteps = [
    help.philosophy.track,
    help.philosophy.analyze,
    help.philosophy.plan,
    help.philosophy.earn,
    help.philosophy.grow,
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3 text-center">
        <WelcomeIllustration size={104} className="mx-auto" />
        <h1 className="font-heading text-2xl font-bold text-balance">{help.title}</h1>
        <p className="text-sm text-muted-foreground">{help.subtitle}</p>
        <p className="text-xs text-muted-foreground">{help.lastUpdated}</p>

        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 rounded-xl border bg-card px-3 py-3 text-sm font-medium shadow-card">
          {philosophySteps.map((step, i) => (
            <span key={step} className="flex items-center gap-1.5">
              <span>{step}</span>
              {i < philosophySteps.length - 1 ? (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              ) : null}
            </span>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{help.gettingStarted.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {help.gettingStarted.steps.map((step, i) => (
            <div key={step.title} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-medium text-primary-foreground">
                {i + 1}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <span aria-hidden="true">{step.emoji}</span>
                  {step.title}
                </p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {help.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span aria-hidden="true" className="text-xl leading-none">
                {section.emoji}
              </span>
              {section.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {section.items.map((item) => (
              <div key={item.title} className="flex gap-3 border-t pt-3 first:border-t-0 first:pt-0">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-base"
                  aria-hidden="true"
                >
                  {item.emoji}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.badge ? (
                      <Badge variant={item.badge === "plus" ? "secondary" : "outline"} className="text-[10px]">
                        {item.badge === "plus" ? help.badges.plus : help.badges.limitedFree}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{locale === "th" ? "คำศัพท์ที่ควรรู้จัก" : "Terms to know"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {help.glossary.map((entry) => (
            <div key={entry.term} className="flex gap-3 border-t pt-3 first:border-t-0 first:pt-0">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-base"
                aria-hidden="true"
              >
                {entry.emoji}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-primary">
                  {entry.term}
                  {entry.termEn ? <span className="ml-1.5 font-normal text-muted-foreground">({entry.termEn})</span> : null}
                </p>
                <p className="text-sm text-muted-foreground">{entry.definition}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">{help.disclaimer}</p>
    </div>
  );
}
