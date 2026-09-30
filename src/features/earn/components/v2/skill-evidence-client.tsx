"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Loader2, Plus, X } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addLearningEvidence, linkSkillToPath, unlinkSkillFromPath } from "@/features/earn/v2-actions";

/** Inline "log what I learned" for one skill (learning evidence). */
export function LogLearningButton({ skillId }: { skillId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const id = `learning-${skillId}`;

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="h-10 px-2 text-primary" onClick={() => setOpen(true)}>
        <BookOpen className="mr-1 size-3.5" aria-hidden="true" />
        {t("earn.v2.skillsV2.logLearning")}
      </Button>
    );
  }
  return (
    <form
      className="w-full space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        start(async () => {
          const res = await addLearningEvidence({ skillId, description: text });
          if (res.error) {
            toast.error(res.error);
            return;
          }
          toast.success(t("earn.v2.skillsV2.saved"));
          setText("");
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <Label htmlFor={id} className="text-xs">
        {t("earn.v2.skillsV2.learningLabel")}
      </Label>
      <Textarea id={id} rows={2} maxLength={1000} autoFocus value={text} className="rounded-xl" placeholder={t("earn.v2.skillsV2.learningPlaceholder")} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-10" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="sm" className="h-10" disabled={pending || !text.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : t("earn.v2.skillsV2.save")}
        </Button>
      </div>
    </form>
  );
}

/** Skills used by a path: chips + add/remove. Results on this path can then count as skill evidence. */
export function PathSkillLinks({
  pathId,
  skills,
  linkedIds,
}: {
  pathId: string;
  skills: { id: string; name: string }[];
  linkedIds: string[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, start] = useTransition();
  const linked = skills.filter((s) => linkedIds.includes(s.id));
  const available = skills.filter((s) => !linkedIds.includes(s.id));

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else router.refresh();
    });

  return (
    <div className="space-y-2">
      {linked.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {linked.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1 rounded-full bg-primary/8 py-1 pr-1 pl-3 text-sm font-medium text-primary">
              {s.name}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => unlinkSkillFromPath({ pathId, skillId: s.id }))}
                className="flex size-7 items-center justify-center rounded-full hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${t("earn.v2.skillsV2.remove")} ${s.name}`}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{skills.length ? t("earn.v2.skillsV2.pathSkillsEmpty") : t("earn.v2.skillsV2.noSkillsYet")}</p>
      )}
      {available.length > 0 ? (
        <Select value="" onValueChange={(v) => v && run(() => linkSkillToPath({ pathId, skillId: v }))}>
          <SelectTrigger className="h-10 w-full rounded-xl sm:w-64" aria-label={t("earn.v2.skillsV2.addSkill")} disabled={pending}>
            <Plus className="size-3.5" aria-hidden="true" />
            <SelectValue>{() => t("earn.v2.skillsV2.addSkill")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {available.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
