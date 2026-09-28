"use client";

import { useSyncExternalStore } from "react";
import { Grid2X2, List, LockKeyhole, Plus } from "lucide-react";

import type { UserSkill } from "@/types/database";
import type { SkillProgress } from "@/lib/skills/progress";
import { parseSkillViewMode, type SkillViewMode } from "@/lib/skills/view-mode";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SkillCard } from "./skill-card";
import { SkillForm } from "./skill-form";

const STORAGE_KEY = "wealth-os:skill-map-view";
const CHANGE_EVENT = "wealth-os:skill-map-view-change";
let memoryValue: SkillViewMode | null = null;

function readViewMode(): SkillViewMode {
  try {
    return parseSkillViewMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "grid";
  }
}

function subscribe(onChange: () => void) {
  function handleCustom(event: Event) {
    memoryValue = (event as CustomEvent<SkillViewMode>).detail;
    onChange();
  }

  function handleStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    memoryValue = null;
    onChange();
  }

  window.addEventListener(CHANGE_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}

function useSkillViewMode(): SkillViewMode {
  return useSyncExternalStore(subscribe, () => memoryValue ?? readViewMode(), () => "grid");
}

function setSkillViewMode(mode: SkillViewMode) {
  memoryValue = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private mode; the in-memory choice still works.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: mode }));
}

export interface SkillMapItem {
  skill: UserSkill;
  progress: SkillProgress;
}

export function SkillMap({ items }: { items: SkillMapItem[] }) {
  const { t } = useTranslation();
  const viewMode = useSkillViewMode();

  return (
    <section className="space-y-4" aria-labelledby="skill-map-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="skill-map-heading" className="text-xl font-semibold tracking-tight">
            {t("earn.skills.skillMapTitle")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("earn.skills.progressHint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-secondary p-1" role="group" aria-label={t("earn.skills.viewModeLabel")}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t("earn.skills.gridView")}
              aria-pressed={viewMode === "grid"}
              onClick={() => setSkillViewMode("grid")}
              className={cn("rounded-full", viewMode === "grid" && "bg-card text-primary shadow-card hover:bg-card")}
            >
              <Grid2X2 className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t("earn.skills.listView")}
              aria-pressed={viewMode === "list"}
              onClick={() => setSkillViewMode("list")}
              className={cn("rounded-full", viewMode === "list" && "bg-card text-primary shadow-card hover:bg-card")}
            >
              <List className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
          <SkillForm
            trigger={
              <Button size="sm" className="h-9 px-3.5">
                <Plus className="size-4" aria-hidden="true" />
                {t("earn.skills.addSkill")}
              </Button>
            }
          />
        </div>
      </div>

      <div className={cn(viewMode === "grid" ? "grid grid-cols-2 gap-3" : "grid gap-4")}>
        {items.map(({ skill, progress }) => (
          <SkillCard key={skill.id} skill={skill} progress={progress} variant={viewMode} />
        ))}

        {viewMode === "grid" ? (
          <SkillForm
            trigger={
              <Button
                variant="ghost"
                className="group min-h-64 w-full flex-col gap-3 whitespace-normal rounded-3xl border border-dashed border-primary/20 bg-primary/[0.025] p-4 text-center text-foreground shadow-none hover:border-primary/35 hover:bg-primary/[0.05]"
              >
                <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-primary/25 bg-primary/5 text-primary transition-transform duration-(--motion-fast) group-hover:scale-105">
                  <LockKeyhole className="size-6" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{t("earn.skills.unlockSkill")}</span>
                  <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">
                    {t("earn.skills.unlockSkillDescription")}
                  </span>
                </span>
              </Button>
            }
          />
        ) : null}
      </div>
    </section>
  );
}
