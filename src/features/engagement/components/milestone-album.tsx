"use client";

import { Check } from "lucide-react";

import { MILESTONE_KEYS, type MilestoneKey } from "@/lib/financial/milestones";
import { useTranslation } from "@/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The seven milestone stickers (2026-10-15, art from
 * public/artwork/milestones/). A reached one is in full colour with a tick;
 * one still ahead is a faded, greyed drawing — state never rests
 * on colour alone. Quiet by design: no modal, no confetti, no countdown.
 */
export function MilestoneAlbum({ milestones }: { milestones: Record<MilestoneKey, boolean> }) {
  const { t } = useTranslation();
  const reached = MILESTONE_KEYS.filter((k) => milestones[k]).length;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{t("milestones.title")}</p>
          <span className="text-sm font-semibold">
            {reached}/{MILESTONE_KEYS.length}
          </span>
        </div>
        <ul className="grid grid-cols-4 gap-x-2 gap-y-3">
          {MILESTONE_KEYS.map((key) => {
            const done = milestones[key];
            return (
              <li key={key} className="flex flex-col items-center gap-2 text-center">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized local WebP */}
                  <img
                    src={`/artwork/milestones/${key}.webp`}
                    alt=""
                    aria-hidden="true"
                    width={128}
                    height={128}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className={cn(
                      "size-16 select-none transition-[filter,opacity]",
                      done ? "drop-shadow-[0_4px_6px_rgba(30,18,6,0.12)]" : "opacity-40 grayscale"
                    )}
                  />
                  {done ? (
                    <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : null}
                </div>
                <span className={cn("text-[11px] leading-tight", done ? "font-medium" : "text-muted-foreground")}>
                  {t(`milestones.items.${key}`)}
                  <span className="sr-only"> — {done ? t("milestones.reached") : t("milestones.notYet")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
