"use client";

import { useState, useTransition } from "react";
import {
  BadgeDollarSign,
  Calculator,
  Camera,
  Clapperboard,
  Code2,
  Dumbbell,
  GraduationCap,
  Headphones,
  Languages,
  Megaphone,
  MoreVertical,
  Palette,
  PenLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { SkillCategory, UserSkill } from "@/types/database";
import { deleteSkill } from "@/features/skills/actions";
import { useTranslation } from "@/i18n/client";
import { SkillForm } from "./skill-form";
import { asTrigger } from "@/lib/as-trigger";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import type { SkillProgress } from "@/lib/skills/progress";

const CATEGORY_ICONS: Record<SkillCategory, LucideIcon> = {
  web_development: Code2,
  design: Palette,
  sales: BadgeDollarSign,
  marketing: Megaphone,
  fitness: Dumbbell,
  teaching: GraduationCap,
  translation: Languages,
  video_editing: Clapperboard,
  photography: Camera,
  accounting: Calculator,
  writing: PenLine,
  customer_service: Headphones,
  other: Sparkles,
};

const CATEGORY_STYLES: Record<SkillCategory, string> = {
  web_development: "bg-[#e4f5ec] text-[#1f4d3e] dark:bg-primary/20 dark:text-[#8fcdb5]",
  design: "bg-[#efeff4] text-[#655f78] dark:bg-[#292631] dark:text-[#b8b0cc]",
  sales: "bg-[#e9f0f4] text-[#526d7c] dark:bg-[#202b31] dark:text-[#9cb6c8]",
  marketing: "bg-[#edf3ef] text-[#476959] dark:bg-[#1d2b24] dark:text-[#91b7a2]",
  fitness: "bg-[#e8f3ef] text-[#386b59] dark:bg-[#1a2d25] dark:text-[#83bca5]",
  teaching: "bg-[#edf1f5] text-[#556b82] dark:bg-[#202831] dark:text-[#8ea2b8]",
  translation: "bg-[#eef1f2] text-[#586b70] dark:bg-[#22292b] dark:text-[#9babad]",
  video_editing: "bg-[#f1eff3] text-[#6d6273] dark:bg-[#2b272e] dark:text-[#b9adbf]",
  photography: "bg-[#eef0ee] text-[#5f6964] dark:bg-[#252a27] dark:text-[#aab3ad]",
  accounting: "bg-[#e8f2f1] text-[#466d69] dark:bg-[#1c2c2a] dark:text-[#8db7b2]",
  writing: "bg-[#f0f0eb] text-[#676959] dark:bg-[#292a24] dark:text-[#b4b5a4]",
  customer_service: "bg-[#edf3eb] text-[#586e50] dark:bg-[#222c1f] dark:text-[#a2b59b]",
  other: "bg-[#f0f1ef] text-[#66706a] dark:bg-[#252a27] dark:text-[#aab3ad]",
};

export function SkillCard({ skill, progress }: { skill: UserSkill; progress: SkillProgress }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const Icon = CATEGORY_ICONS[skill.category];
  const nextLevelText = progress.nextLevel
    ? t("earn.skills.nextLevel")
        .replace("{count}", String(progress.workUntilNextLevel))
        .replace("{level}", String(progress.nextLevel))
    : t("earn.skills.maxLevel");

  return (
    <Card className="relative gap-0 overflow-visible rounded-3xl py-0">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className={`relative flex size-16 shrink-0 items-center justify-center rounded-2xl ${CATEGORY_STYLES[skill.category]}`}>
            <div className="absolute inset-1 rounded-xl border border-current/10" />
            <Icon className="relative size-8" strokeWidth={1.65} aria-hidden="true" />
            <span className="absolute -bottom-2 -right-2 flex min-w-8 items-center justify-center rounded-full bg-primary px-1.5 py-1 text-[10px] font-bold text-primary-foreground ring-4 ring-card">
              Lv.{progress.level}
            </span>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {/* leading-tight, not leading-none — Thai tone marks need the extra line box. */}
                <p className="truncate text-base font-semibold leading-tight">{skill.skill_name}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {t(`earn.skills.categories.${skill.category}`)} · {t(`earn.skills.proficiencyLevels.${skill.proficiency_level}`)}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  {...asTrigger(
                    <Button variant="ghost" size="icon" className="-mr-2 -mt-2 size-9 rounded-full" aria-label={t("common.moreActions")}>
                      <MoreVertical className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>{t("common.edit")}</DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isPending}
                    onClick={async () => {
                      if (!(await confirm(t("earn.skills.deleteConfirm"), { destructive: true }))) return;
                      startTransition(async () => {
                        await deleteSkill(skill.id);
                      });
                    }}
                  >
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-secondary/70 p-3.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium">{progress.completedWorkCount} {t("earn.skills.workCompleted")}</span>
            <span className="text-right text-muted-foreground">{nextLevelText}</span>
          </div>
          <div
            className="mt-2.5 h-2 overflow-hidden rounded-full bg-primary/10"
            role="progressbar"
            aria-label={t("earn.skills.levelProgress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.progressPercent}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-(--motion-value) ease-(--ease-emphasized)"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {skill.monetized_before ? (
            <span className="rounded-full bg-primary/8 px-2.5 py-1 font-medium text-primary">
              {t("earn.skills.earnedBefore")}
            </span>
          ) : null}
          <span className="rounded-full bg-muted px-2.5 py-1">
            {t(`earn.skills.interestLevels.${skill.interest_level}`)} {t("earn.skills.interestSuffix")}
          </span>
          {skill.available_hours_per_week !== null ? (
            <span className="rounded-full bg-muted px-2.5 py-1">
              {skill.available_hours_per_week} {t("earn.skills.hoursPerWeekUnit")}
            </span>
          ) : null}
        </div>
      </CardContent>
      <SkillForm skill={skill} trigger={null} open={editOpen} onOpenChange={setEditOpen} />
      {confirmDialog}
    </Card>
  );
}
