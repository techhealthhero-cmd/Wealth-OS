"use client";

import { cloneElement, useEffect, useState, useActionState, type ReactElement } from "react";

import { createSkill, updateSkill } from "@/features/skills/actions";
import { SKILL_CATEGORIES, PROFICIENCY_LEVELS, INTEREST_LEVELS } from "@/lib/validation/skill";
import { useTranslation } from "@/i18n/client";
import type { UserSkill } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useMinimizableFormActions } from "@/components/shared/minimizable-form-context";
import { MinimizableFormShell } from "@/components/shared/minimizable-form-shell";

interface SkillFormProps {
  skill?: UserSkill;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Thin trigger/open-state wrapper — see goal-form.tsx for why the fields live in a separate, fully self-contained subcomponent. */
export function SkillForm({ skill, trigger, open, onOpenChange }: SkillFormProps) {
  const { t } = useTranslation();
  const { openForm, close: closeMinimizable } = useMinimizableFormActions();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const formId = skill ? `skill-form-edit-${skill.id}` : "skill-form-add";
  const title = skill ? t("earn.skills.editSkill") : t("earn.skills.addSkill");

  useEffect(() => {
    if (dialogOpen) {
      openForm({
        id: formId,
        title,
        content: <SkillFormFields skill={skill} title={title} onOpenChange={setDialogOpen} />,
      });
    } else {
      closeMinimizable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  if (trigger === null) return null;

  const triggerElement =
    trigger ?? (
      <Button>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        {t("earn.skills.addSkill")}
      </Button>
    );

  return cloneElement(triggerElement as ReactElement<{ onClick?: () => void }>, {
    onClick: () => setDialogOpen(true),
  });
}

function SkillFormFields({
  skill,
  title,
  onOpenChange,
}: {
  skill?: UserSkill;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { close: closeMinimizable } = useMinimizableFormActions();
  const action = skill ? updateSkill.bind(null, skill.id) : createSkill;
  const [state, formAction, isPending] = useActionState(action, undefined);

  function handleClose() {
    onOpenChange(false);
    closeMinimizable();
  }

  useEffect(() => {
    if (state?.success) handleClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <MinimizableFormShell title={title} onClose={handleClose}>
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="skill_name">{t("earn.skills.skillName")}</Label>
          <Input id="skill_name" name="skill_name" defaultValue={skill?.skill_name} required maxLength={80} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">{t("earn.skills.category")}</Label>
          <Select name="category" defaultValue={skill?.category ?? "other"}>
            <SelectTrigger id="category">
              <SelectValue>{(value: string) => t(`earn.skills.categories.${value}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SKILL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`earn.skills.categories.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="proficiency_level">{t("earn.skills.proficiency")}</Label>
            <Select name="proficiency_level" defaultValue={skill?.proficiency_level ?? "beginner"}>
              <SelectTrigger id="proficiency_level">
                <SelectValue>{(value: string) => t(`earn.skills.proficiencyLevels.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PROFICIENCY_LEVELS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`earn.skills.proficiencyLevels.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="interest_level">{t("earn.skills.interestLevel")}</Label>
            <Select name="interest_level" defaultValue={skill?.interest_level ?? "medium"}>
              <SelectTrigger id="interest_level">
                <SelectValue>{(value: string) => t(`earn.skills.interestLevels.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {INTEREST_LEVELS.map((i) => (
                  <SelectItem key={i} value={i}>
                    {t(`earn.skills.interestLevels.${i}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="experience_months">{t("earn.skills.experience")}</Label>
            <Input
              id="experience_months"
              name="experience_months"
              type="number"
              min="0"
              step="1"
              defaultValue={skill?.experience_months ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="available_hours_per_week">{t("earn.skills.availableHours")}</Label>
            <Input
              id="available_hours_per_week"
              name="available_hours_per_week"
              type="number"
              min="0"
              max="168"
              step="0.5"
              defaultValue={skill?.available_hours_per_week ?? ""}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="monetized_before" name="monetized_before" defaultChecked={skill?.monetized_before ?? false} />
          <Label htmlFor="monetized_before" className="font-normal">
            {t("earn.skills.monetizedBefore")}
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{t("earn.skills.notes")}</Label>
          <Textarea id="notes" name="notes" defaultValue={skill?.notes ?? ""} maxLength={500} />
        </div>

        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? t("common.saving") : t("common.save")}
        </Button>
      </form>
    </MinimizableFormShell>
  );
}
