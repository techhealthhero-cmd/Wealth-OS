"use client";

import { useState, useTransition } from "react";
import { MoreVertical } from "lucide-react";

import type { UserSkill } from "@/types/database";
import { deleteSkill } from "@/features/skills/actions";
import { useTranslation } from "@/i18n/client";
import { SkillForm } from "./skill-form";
import { asTrigger } from "@/lib/as-trigger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";

export function SkillCard({ skill }: { skill: UserSkill }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate font-medium leading-none">{skill.skill_name}</p>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {t(`earn.skills.proficiencyLevels.${skill.proficiency_level}`)}
            </Badge>
            {skill.monetized_before ? (
              <Badge className="shrink-0 bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                {t("earn.skills.monetizedBefore")}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {t(`earn.skills.categories.${skill.category}`)} · {t(`earn.skills.interestLevels.${skill.interest_level}`)}
            {skill.available_hours_per_week !== null ? ` · ${skill.available_hours_per_week} ${t("earn.skills.hoursPerWeekUnit")}` : ""}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            {...asTrigger(
              <Button variant="ghost" size="icon" aria-label={t("common.moreActions")}>
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
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
      </CardContent>
      <SkillForm skill={skill} trigger={null} open={editOpen} onOpenChange={setEditOpen} />
      {confirmDialog}
    </Card>
  );
}
