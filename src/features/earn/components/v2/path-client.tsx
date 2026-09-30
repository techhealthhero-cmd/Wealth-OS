"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ClipboardList, Loader2, Pause, Play, Plus } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeEarnMission, createEarnProject, setIncomePathStatus } from "@/features/earn/v2-actions";

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
