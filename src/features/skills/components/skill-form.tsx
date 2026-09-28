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
import { Check, ChevronDown, Lightbulb, Plus, Sparkles } from "lucide-react";
import { useMinimizableFormActions } from "@/components/shared/minimizable-form-context";
import { MinimizableFormShell } from "@/components/shared/minimizable-form-shell";
import { cn } from "@/lib/utils";

type SkillCategory = (typeof SKILL_CATEGORIES)[number];
type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];
type InterestLevel = (typeof INTEREST_LEVELS)[number];

const SKILL_EXAMPLES: { key: string; category: SkillCategory }[] = [
  { key: "design", category: "design" },
  { key: "selling", category: "sales" },
  { key: "social", category: "marketing" },
  { key: "video", category: "video_editing" },
  { key: "language", category: "translation" },
  { key: "teaching", category: "teaching" },
];

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
  const [skillName, setSkillName] = useState(skill?.skill_name ?? "");
  const [category, setCategory] = useState<SkillCategory>(skill?.category ?? "other");
  const [proficiency, setProficiency] = useState<ProficiencyLevel>(skill?.proficiency_level ?? "beginner");
  const [interest, setInterest] = useState<InterestLevel>(skill?.interest_level ?? "medium");
  const [availableHours, setAvailableHours] = useState(
    skill?.available_hours_per_week === null || skill?.available_hours_per_week === undefined
      ? ""
      : String(skill.available_hours_per_week)
  );
  const [showDetails, setShowDetails] = useState(Boolean(skill));

  function handleClose() {
    onOpenChange(false);
    closeMinimizable();
  }

  useEffect(() => {
    if (state?.success) handleClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <MinimizableFormShell title={title} onClose={handleClose} className="sm:max-w-lg">
      <form action={formAction} className="space-y-5">
        {!skill ? (
          <div className="flex gap-3 rounded-2xl bg-primary/7 p-3.5 ring-1 ring-primary/10">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Sparkles className="size-4.5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">{t("earn.skills.guideTitle")}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("earn.skills.guideDescription")}</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="skill_name" className="text-sm font-semibold">
            {t("earn.skills.skillNameQuestion")}
          </Label>
          <Input
            id="skill_name"
            name="skill_name"
            value={skillName}
            onChange={(event) => setSkillName(event.target.value)}
            placeholder={t("earn.skills.skillNamePlaceholder")}
            autoComplete="off"
            required
            maxLength={80}
            className="h-11 rounded-xl text-base"
          />
          {!skill ? (
            <div className="space-y-2 pt-1">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lightbulb className="size-3.5 text-amber-500" aria-hidden="true" />
                {t("earn.skills.examplesHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                {SKILL_EXAMPLES.map((example) => {
                  const label = t(`earn.skills.examples.${example.key}`);
                  const selected = skillName === label;
                  return (
                    <button
                      key={example.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setSkillName(label);
                        setCategory(example.category);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div>
            <Label htmlFor="category" className="text-sm font-semibold">
              {t("earn.skills.categoryQuestion")}
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("earn.skills.categoryHint")}</p>
          </div>
          <Select
            name="category"
            value={category}
            onValueChange={(value) => value && setCategory(value as SkillCategory)}
          >
            <SelectTrigger id="category" className="h-11 w-full rounded-xl px-3">
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

        <div className="space-y-2.5">
          <Label className="text-sm font-semibold">{t("earn.skills.proficiencyQuestion")}</Label>
          <input type="hidden" name="proficiency_level" value={proficiency} />
          <div className="grid grid-cols-2 gap-2">
            {PROFICIENCY_LEVELS.map((level) => {
              const selected = proficiency === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setProficiency(level)}
                  className={cn(
                    "relative min-h-16 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98]",
                    selected ? "border-primary bg-primary/8 ring-1 ring-primary/20" : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="block pr-5 text-sm font-semibold">{t(`earn.skills.proficiencyLevels.${level}`)}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {t(`earn.skills.proficiencyDescriptions.${level}`)}
                  </span>
                  {selected ? <Check className="absolute top-2.5 right-2.5 size-4 text-primary" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5">
          <Label className="text-sm font-semibold">{t("earn.skills.interestQuestion")}</Label>
          <input type="hidden" name="interest_level" value={interest} />
          <div className="grid grid-cols-3 gap-2">
            {INTEREST_LEVELS.map((level) => {
              const selected = interest === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setInterest(level)}
                  className={cn(
                    "min-h-16 rounded-xl border px-2 py-2.5 text-center transition-all active:scale-[0.98]",
                    selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="block text-sm font-semibold">{t(`earn.skills.interestLevels.${level}`)}</span>
                  <span className={cn("mt-0.5 block text-[10px] leading-tight", selected ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    {t(`earn.skills.interestDescriptions.${level}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 rounded-2xl border bg-muted/25 p-3.5">
          <div>
            <Label htmlFor="available_hours_per_week" className="text-sm font-semibold">
              {t("earn.skills.availableHoursQuestion")}
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("earn.skills.availableHoursHint")}</p>
          </div>
          <div className="flex gap-2">
            {["2", "5", "10"].map((hours) => (
              <button
                key={hours}
                type="button"
                aria-pressed={availableHours === hours}
                onClick={() => setAvailableHours(hours)}
                className={cn(
                  "flex-1 rounded-full border px-2 py-1.5 text-xs font-medium transition-colors",
                  availableHours === hours ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {hours} {t("earn.skills.hoursPerWeekUnit")}
              </button>
            ))}
          </div>
          <Input
            id="available_hours_per_week"
            name="available_hours_per_week"
            type="number"
            inputMode="decimal"
            min="0"
            max="168"
            step="0.5"
            value={availableHours}
            onChange={(event) => setAvailableHours(event.target.value)}
            placeholder={t("earn.skills.availableHoursPlaceholder")}
            className="h-10 rounded-xl bg-background"
          />
        </div>

        <div className="rounded-2xl border">
          <button
            type="button"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-semibold">{t("earn.skills.optionalDetails")}</span>
              <span className="block text-xs text-muted-foreground">{t("earn.skills.optionalDetailsHint")}</span>
            </span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted-foreground transition-transform", showDetails && "rotate-180")}
              aria-hidden="true"
            />
          </button>
          <div className={cn("space-y-4 border-t p-3.5", !showDetails && "hidden")}>
            <div className="space-y-2">
              <Label htmlFor="experience_months">{t("earn.skills.experienceQuestion")}</Label>
              <Input
                id="experience_months"
                name="experience_months"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder={t("earn.skills.experiencePlaceholder")}
                defaultValue={skill?.experience_months ?? ""}
                className="h-10 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">{t("earn.skills.optionalHint")}</p>
            </div>

            <label htmlFor="monetized_before" className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/40 p-3">
              <Checkbox id="monetized_before" name="monetized_before" defaultChecked={skill?.monetized_before ?? false} />
              <span className="text-sm leading-snug">{t("earn.skills.monetizedBefore")}</span>
            </label>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("earn.skills.notesQuestion")}</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={skill?.notes ?? ""}
                placeholder={t("earn.skills.notesPlaceholder")}
                maxLength={500}
                className="min-h-20 rounded-xl"
              />
            </div>
          </div>
        </div>

        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="h-11 w-full text-sm" disabled={isPending || !skillName.trim()}>
          {isPending ? t("common.saving") : skill ? t("common.save") : t("earn.skills.saveAndMatch")}
        </Button>
      </form>
    </MinimizableFormShell>
  );
}
