"use client";

import { useEffect, useId, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { selectCompanion, syncCompanionUnlocks } from "@/features/companions/actions";
import { setCompanionPresenceEnabled, useCompanionPresenceEnabled } from "@/features/companions/presence";
import type { CompanionFocus, CompanionKind, UnlockRuleId } from "@/lib/companions/catalog";
import type { UnlockProgress } from "@/lib/companions/unlock";

export interface CompanionCardData {
  id: string;
  kind: CompanionKind;
  image: string;
  focus: CompanionFocus;
  available: boolean;
  selected: boolean;
  starter: boolean;
  unlockRule: UnlockRuleId | null;
  requiredPlan: "plus" | "pro" | null;
  progress: UnlockProgress | null;
}

export function CompanionPicker({
  cards,
  presenceAvailable,
}: {
  cards: CompanionCardData[];
  presenceAvailable: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Visiting this page always re-checks progress, so a spirit earned since
  // the last background check shows up right away.
  useEffect(() => {
    let cancelled = false;
    syncCompanionUnlocks()
      .then((ids) => {
        if (cancelled || ids.length === 0) return;
        for (const id of ids) {
          toast.success(t("companions.unlockedBubble").replace("{name}", t(`companions.names.${id}`)));
        }
        router.refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await selectCompanion(id);
      setPendingId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t("companions.chosenToast").replace("{name}", t(`companions.names.${id}`)));
      router.refresh();
    });
  }

  const spirits = cards.filter((c) => c.kind === "spirit");
  const wizards = cards.filter((c) => c.kind === "wizard");

  return (
    <div className="space-y-6">
      <PresenceCard available={presenceAvailable} />

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">{t("companions.spiritsTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("companions.spiritsHint")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {spirits.map((c) => (
            <CompanionCard key={c.id} card={c} pending={pendingId === c.id} onChoose={choose} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">{t("companions.wizardsTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("companions.wizardsHint")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {wizards.map((c) => (
            <CompanionCard key={c.id} card={c} pending={pendingId === c.id} onChoose={choose} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CompanionCard({
  card,
  pending,
  onChoose,
}: {
  card: CompanionCardData;
  pending: boolean;
  onChoose: (id: string) => void;
}) {
  const { t } = useTranslation();
  const name = t(`companions.names.${card.id}`);

  return (
    <Card className={cn("h-full", card.selected && "ring-2 ring-primary")}>
      <CardContent className="flex h-full flex-col items-center gap-2 p-3 text-center">
        <div className="relative">
          <Image
            src={card.image}
            alt={name}
            width={88}
            height={88}
            className={cn("size-[88px] rounded-full object-cover", !card.available && "opacity-40 grayscale")}
          />
          {!card.available ? (
            <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border bg-background shadow-sm">
              <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{name}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-primary">{t(`companions.lines.${card.focus}`)}</p>
          <p className="text-xs text-muted-foreground">{t(`companions.focus.${card.focus}`)}</p>
        </div>

        <div className="mt-auto w-full space-y-1.5 pt-1">
          {card.selected ? (
            <Badge className="w-full justify-center gap-1">
              <Check className="size-3" aria-hidden="true" />
              {t("companions.selected")}
            </Badge>
          ) : card.available ? (
            <Button size="sm" variant="outline" className="w-full" disabled={pending} onClick={() => onChoose(card.id)}>
              {t("companions.choose")}
            </Button>
          ) : card.unlockRule ? (
            <div className="space-y-1 text-left">
              <p className="text-[11px] font-medium text-muted-foreground">{t("companions.howToUnlock")}</p>
              <p className="text-xs leading-snug">{t(`companions.unlockRules.${card.unlockRule}`)}</p>
              {card.progress && card.progress.target > 0 ? (
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={card.progress.target}
                  aria-valuenow={card.progress.current}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-(--motion-value)"
                    style={{ width: `${(card.progress.current / card.progress.target) * 100}%` }}
                  />
                </div>
              ) : null}
              {card.unlockRule === "emergency_fund_one_month" && card.progress ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("companions.progressMonths")
                    .replace("{current}", String(card.progress.current))
                    .replace("{target}", String(card.progress.target))}
                </p>
              ) : null}
            </div>
          ) : card.requiredPlan ? (
            <Button nativeButton={false} render={<Link href="/pricing" />} size="sm" variant="outline" className="w-full">
              {t(card.requiredPlan === "pro" ? "companions.needsPro" : "companions.needsPlus")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PresenceCard({ available }: { available: boolean }) {
  const { t } = useTranslation();
  const enabled = useCompanionPresenceEnabled();
  const labelId = useId();

  return (
    <Card variant="soft">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold">{t("companions.presenceTitle")}</p>
          {!available ? <Badge variant="secondary">Plus</Badge> : null}
        </div>
        {available ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p id={labelId} className="text-sm font-medium">
                {t("companions.presenceToggle")}
              </p>
              <p className="text-xs text-muted-foreground">{t("companions.presenceOnHint")}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-labelledby={labelId}
              onClick={() => setCompanionPresenceEnabled(!enabled)}
              className={cn(
                "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-(--motion-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                enabled ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "inline-block size-5 rounded-full bg-background shadow transition-transform duration-(--motion-fast)",
                  enabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("companions.presenceLockedHint")}</p>
            <Button nativeButton={false} render={<Link href="/pricing" />} size="sm" variant="outline">
              {t("companions.seePlans")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
