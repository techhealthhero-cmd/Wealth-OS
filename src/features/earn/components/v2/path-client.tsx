"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Check, ClipboardList, Loader2, Pause, Play, Plus, RotateCcw } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignEarnMissionProject,
  completeEarnMission,
  createEarnProject,
  setEarnProjectStatus,
  setIncomePathStatus,
} from "@/features/earn/v2-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NO_PROJECT = "__none__";

/** Mission CTA: mark done, or record the result when one is required. */
export function MissionActions({
  missionId,
  status,
  resultRequired,
  hasResult,
}: {
  missionId: string;
  status: string;
  resultRequired: boolean;
  hasResult: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, start] = useTransition();
  const done = status === "completed";

  if (done && resultRequired && !hasResult) {
    return (
      <Button className="h-11 w-full rounded-2xl" nativeButton={false} render={<Link href={`/earn/missions/${missionId}/result`} />}>
        <ClipboardList className="mr-1.5 size-4" aria-hidden="true" />
        {t("earn.v2.missions.recordResult")}
      </Button>
    );
  }
  if (done) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-primary dark:text-[#7FD6B2]">
        <Check className="size-4" aria-hidden="true" />
        {t("earn.v2.missions.done")}
      </p>
    );
  }
  return (
    <div className="flex gap-2">
      <Button
        className="h-11 flex-1 rounded-2xl"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await completeEarnMission(missionId);
            if (res.error) {
              toast.error(res.error);
              return;
            }
            if (resultRequired) router.push(`/earn/missions/${missionId}/result`);
            else router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <Check className="mr-1.5 size-4" aria-hidden="true" />}
        {pending ? t("earn.v2.missions.completing") : t("earn.v2.missions.complete")}
      </Button>
    </div>
  );
}

export function PathStatusToggle({ pathId, status }: { pathId: string; status: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, start] = useTransition();
  const paused = status === "paused";
  if (status !== "active" && !paused) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-10"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setIncomePathStatus(pathId, paused ? "active" : "paused");
          if (res.error) toast.error(res.error);
          else router.refresh();
        })
      }
    >
      {paused ? <Play className="mr-1 size-3.5" aria-hidden="true" /> : <Pause className="mr-1 size-3.5" aria-hidden="true" />}
      {paused ? t("earn.v2.paths.resume") : t("earn.v2.paths.pause")}
    </Button>
  );
}

export function ProjectCreateForm({ pathId }: { pathId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="h-10 rounded-xl" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-3.5" aria-hidden="true" />
        {t("earn.v2.projects.new")}
      </Button>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        start(async () => {
          const res = await createEarnProject({ pathId, title });
          if (res.error) {
            toast.error(res.error);
            return;
          }
          setTitle("");
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <Label htmlFor="project-title">{t("earn.v2.projects.titleLabel")}</Label>
      <div className="flex gap-2">
        <Input
          id="project-title"
          className="h-11 rounded-xl"
          value={title}
          maxLength={120}
          autoFocus
          placeholder={t("earn.v2.projects.titlePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" className="h-11 rounded-xl" disabled={pending || !title.trim()}>
          {pending ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" /> : null}
          {t("earn.v2.projects.create")}
        </Button>
      </div>
    </form>
  );
}

export function ProjectStatusActions({ projectId, status }: { projectId: string; status: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (next: "active" | "completed" | "archived") =>
    start(async () => {
      const result = await setEarnProjectStatus(projectId, next);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  return (
    <div className="flex shrink-0 items-center gap-1">
      {status === "completed" ? (
        <Button type="button" variant="ghost" size="sm" className="min-h-10" disabled={pending} onClick={() => run("active")}>
          <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
          {t("earn.v2.projects.reactivate")}
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="min-h-10" disabled={pending} onClick={() => run("completed")}>
          <Check className="mr-1 size-3.5" aria-hidden="true" />
          {t("earn.v2.projects.markCompleted")}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10"
        disabled={pending}
        aria-label={t("earn.v2.projects.archive")}
        onClick={() => run("archived")}
      >
        <Archive className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function MissionProjectPicker({
  missionId,
  projectId,
  projects,
}: {
  missionId: string;
  projectId: string | null;
  projects: { id: string; title: string }[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [value, setValue] = useState(projectId ?? NO_PROJECT);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Label htmlFor="mission-project">{t("earn.v2.projects.missionLabel")}</Label>
      <Select
        value={value}
        disabled={pending}
        onValueChange={(next) => {
          const selected = next ?? NO_PROJECT;
          setValue(selected);
          start(async () => {
            const result = await assignEarnMissionProject(missionId, selected === NO_PROJECT ? null : selected);
            if (result.error) {
              toast.error(result.error);
              setValue(projectId ?? NO_PROJECT);
            } else {
              toast.success(t("earn.v2.projects.missionSaved"));
              router.refresh();
            }
          });
        }}
      >
        <SelectTrigger id="mission-project" className="h-11 w-full rounded-xl">
          <SelectValue>
            {(selected: string) =>
              selected === NO_PROJECT
                ? t("earn.v2.projects.missionNone")
                : projects.find((project) => project.id === selected)?.title ?? t("earn.v2.projects.missionNone")
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PROJECT}>{t("earn.v2.projects.missionNone")}</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
