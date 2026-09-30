"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Minus, Plus } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { recordEarnMissionResult } from "@/features/earn/v2-actions";
import { EXPERIMENT_DECISIONS, type ExperimentDecision } from "@/lib/earn/mission-templates";

const NO_SKILL = "__none__";

/**
 * Structured, honest result entry: only the step's own counters (nothing is
 * pre-filled or inferred), a decision about what's next, optional notes and
 * optional skill evidence. Validation (funnel order) is repeated server-side.
 */
export function MissionResultForm({
  missionId,
  pathId,
  fields,
  mayProduceIncome,
  skills,
  defaultSkillId = null,
}: {
  missionId: string;
  pathId: string;
  fields: string[];
  mayProduceIncome: boolean;
  skills: { id: string; name: string }[];
  defaultSkillId?: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(fields.map((f) => [f, 0])));
  const [decision, setDecision] = useState<ExperimentDecision>("continue");
  const [notes, setNotes] = useState("");
  const [skillId, setSkillId] = useState(defaultSkillId ?? NO_SKILL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (f: string, v: number) => {
    setError(null);
    setCounts((c) => ({ ...c, [f]: Math.max(0, Math.min(100_000, Math.floor(v || 0))) }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await recordEarnMissionResult({
      missionId,
      counts,
      decision,
      notes: notes.trim() || null,
      skillId: skillId === NO_SKILL ? null : skillId,
    }).catch(() => ({ error: t("earn.v2.missions.failed") }) as { error: string; success?: boolean });
    if (res.error) {
      setSaving(false);
      setError(res.error);
      return;
    }
    toast.success(t("earn.v2.missions.result.saved"));
    const last = fields[fields.length - 1];
    const earned = mayProduceIncome && last !== undefined && (counts[last] ?? 0) > 0;
    if (decision === "switch") router.push("/earn/paths/new");
    else router.push(earned ? `/earn/paths/${pathId}/income` : `/earn/paths/${pathId}`);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{t("earn.v2.missions.result.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("earn.v2.missions.result.hint")}</p>
      </div>

      {fields.length > 0 ? (
        <div className="space-y-2.5">
          {fields.map((f) => (
            <div key={f} className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-2.5">
              <Label htmlFor={`count-${f}`} className="text-sm font-medium">
                {t(`earn.v2.missions.result.fields.${f}`)}
              </Label>
              <div className="flex items-center gap-1.5">
                <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" aria-label="−" onClick={() => set(f, counts[f] - 1)}>
                  <Minus className="size-4" aria-hidden="true" />
                </Button>
                <Input
                  id={`count-${f}`}
                  inputMode="numeric"
                  className="h-11 w-16 rounded-xl text-center text-base tabular-nums"
                  value={String(counts[f])}
                  onChange={(e) => set(f, Number(e.target.value.replace(/\D/g, "")))}
                />
                <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" aria-label="+" onClick={() => set(f, counts[f] + 1)}>
                  <Plus className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t("earn.v2.missions.result.decision.title")}</legend>
        <div role="radiogroup" aria-label={t("earn.v2.missions.result.decision.title")} className="grid grid-cols-2 gap-2">
          {EXPERIMENT_DECISIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={decision === d}
              onClick={() => setDecision(d)}
              className={cn(
                "min-h-12 rounded-2xl border bg-card px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                decision === d ? "border-primary bg-primary/8 text-primary" : "hover:bg-muted/50"
              )}
            >
              {t(`earn.v2.missions.result.decision.${d}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="result-notes">{t("earn.v2.missions.result.notes")}</Label>
        <Textarea
          id="result-notes"
          value={notes}
          maxLength={2000}
          rows={3}
          className="rounded-2xl"
          placeholder={t("earn.v2.missions.result.notesPlaceholder")}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {skills.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="result-skill">{t("earn.v2.missions.result.skill")}</Label>
          <Select value={skillId} onValueChange={(v) => setSkillId(v ?? NO_SKILL)}>
            <SelectTrigger id="result-skill" className="h-11 rounded-xl">
              <SelectValue>{(v: string) => (v === NO_SKILL ? t("earn.v2.missions.result.noSkill") : skills.find((s) => s.id === v)?.name ?? "")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SKILL}>{t("earn.v2.missions.result.noSkill")}</SelectItem>
              {skills.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="h-12 w-full rounded-2xl text-base" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
            {t("earn.v2.missions.result.saving")}
          </>
        ) : (
          t("earn.v2.missions.result.save")
        )}
      </Button>
    </form>
  );
}
