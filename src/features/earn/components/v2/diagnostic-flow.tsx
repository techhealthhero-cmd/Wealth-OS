"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { submitDiagnostic } from "@/features/earn/v2-actions";
import {
  ABILITIES,
  CAPITAL_BUCKETS,
  DIAGNOSTIC_STEPS,
  HOURS_BUCKETS,
  INCOME_SITUATIONS,
  PRIORITIES,
  RESOURCES,
  WORK_PREFERENCES,
  firstIncompleteStep,
  type DiagnosticAnswers,
  type DiagnosticStep,
} from "@/lib/earn/diagnostic";
import { diagnosticAnswersSchema } from "@/lib/validation/earn";

type Draft = Partial<DiagnosticAnswers> & { hoursKey?: string; capitalKey?: string };

const ASKS_STEADY = new Set(["freelance", "business", "investment"]);

function loadDraft(key: string): Draft {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : {};
  } catch {
    return {};
  }
}

function toMinor(value: string): number | undefined {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

/**
 * One question per screen. The draft lives in this device's localStorage
 * (keyed per user) so refresh / back / leaving and returning all resume where
 * the user left off; only a completed answer set is sent, as a new immutable
 * snapshot. Rendered client-only (see diagnostic-flow-loader.tsx), so reading
 * the saved draft in the initial state never mismatches server HTML.
 */
export default function DiagnosticFlow({ draftKey }: { draftKey: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => loadDraft(draftKey));
  const [resumed] = useState(() => Object.keys(loadDraft(draftKey)).length > 0);
  const [stepIndex, setStepIndex] = useState(() => {
    const first = firstIncompleteStep(loadDraft(draftKey));
    return first ? DIAGNOSTIC_STEPS.indexOf(first) : DIAGNOSTIC_STEPS.length - 1;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step: DiagnosticStep = DIAGNOSTIC_STEPS[stepIndex];
  const total = DIAGNOSTIC_STEPS.length;
  const s = (key: string) => t(`earn.v2.diagnostic.steps.${step}.${key}`);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // storage full/blocked — the flow still works, just without resume
    }
  }, [draft, draftKey]);

  // Move focus to the new question so screen readers announce it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  const update = (patch: Draft) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const toggle = <T extends string>(field: "availableResources" | "workPreferences" | "existingAbilities", value: T, exclusive?: T) => {
    const current = (draft[field] as string[] | undefined) ?? [];
    let next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    if (exclusive) next = value === exclusive ? (next.includes(exclusive) ? [exclusive] : []) : next.filter((v) => v !== exclusive);
    update({ [field]: next } as Draft);
  };

  const stepValid = (): boolean => {
    switch (step) {
      case "income":
        return Boolean(draft.incomeSituation) && draft.monthlyIncomeMinor !== undefined &&
          (!ASKS_STEADY.has(draft.incomeSituation!) || draft.incomeIsSteady !== undefined);
      case "expenses":
        return (draft.essentialExpensesMinor ?? 0) > 0;
      case "resources":
        return true;
      case "preferences":
        return (draft.workPreferences?.length ?? 0) > 0;
      case "abilities":
        return (draft.existingAbilities?.length ?? 0) > 0;
      case "time":
        return draft.availableHoursPerWeek !== undefined;
      case "capital":
        return draft.startingCapitalMinor !== undefined;
      case "priority":
        return Boolean(draft.currentPriority);
    }
  };

  async function finish() {
    const answers = {
      ...draft,
      availableResources: draft.availableResources ?? [],
      incomeIsSteady: ASKS_STEADY.has(draft.incomeSituation ?? "") ? draft.incomeIsSteady ?? null : null,
      startingCapitalCurrency: "THB",
    };
    const parsed = diagnosticAnswersSchema.safeParse(answers);
    if (!parsed.success) {
      setError(t("earn.v2.diagnostic.saveFailed"));
      return;
    }
    setSaving(true);
    const res = await submitDiagnostic(parsed.data).catch(() => ({ error: t("earn.v2.diagnostic.saveFailed") }));
    if ("success" in res && res.success) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {}
      router.push("/earn/diagnostic/result");
      return;
    }
    setSaving(false);
    setError(("error" in res && res.error) || t("earn.v2.diagnostic.saveFailed"));
  }

  const isLast = stepIndex === total - 1;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("earn.v2.diagnostic.progress").replace("{current}", String(stepIndex + 1)).replace("{total}", String(total))}</span>
          {resumed && stepIndex > 0 ? <span>{t("earn.v2.diagnostic.resumed")}</span> : null}
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={stepIndex + 1}
          aria-label={t("earn.v2.diagnostic.progress").replace("{current}", String(stepIndex + 1)).replace("{total}", String(total))}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="space-y-1">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold leading-snug text-balance outline-none">
          {s("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{s("hint")}</p>
      </div>

      {step === "income" ? (
        <div className="space-y-4">
          <ChoiceGroup
            label={s("title")}
            options={INCOME_SITUATIONS.map((o) => ({ value: o, label: s(`options.${o}`) }))}
            selected={draft.incomeSituation ? [draft.incomeSituation] : []}
            onSelect={(v) =>
              update({
                incomeSituation: v as DiagnosticAnswers["incomeSituation"],
                monthlyIncomeMinor: v === "none" ? 0 : draft.incomeSituation === "none" ? undefined : draft.monthlyIncomeMinor,
                incomeIsSteady: ASKS_STEADY.has(v) ? draft.incomeIsSteady : undefined,
              })
            }
          />
          {draft.incomeSituation && draft.incomeSituation !== "none" ? (
            <MoneyField
              id="monthly-income"
              label={s("amountLabel")}
              valueMinor={draft.monthlyIncomeMinor}
              onChange={(m) => update({ monthlyIncomeMinor: m })}
            />
          ) : null}
          {draft.incomeSituation && ASKS_STEADY.has(draft.incomeSituation) ? (
            <ChoiceGroup
              label={s("steadyLabel")}
              showLabel
              columns={2}
              options={[
                { value: "yes", label: s("steadyYes") },
                { value: "no", label: s("steadyNo") },
              ]}
              selected={draft.incomeIsSteady === undefined || draft.incomeIsSteady === null ? [] : [draft.incomeIsSteady ? "yes" : "no"]}
              onSelect={(v) => update({ incomeIsSteady: v === "yes" })}
            />
          ) : null}
        </div>
      ) : null}

      {step === "expenses" ? (
        <MoneyField
          id="essential-expenses"
          label={s("amountLabel")}
          valueMinor={draft.essentialExpensesMinor}
          onChange={(m) => update({ essentialExpensesMinor: m })}
        />
      ) : null}

      {step === "resources" || step === "preferences" || step === "abilities" ? (
        <>
          <p className="text-xs font-medium text-muted-foreground">{t("earn.v2.diagnostic.chooseMany")}</p>
          <ChoiceGroup
            label={s("title")}
            multiple
            columns={2}
            options={(step === "resources" ? RESOURCES : step === "preferences" ? WORK_PREFERENCES : ABILITIES).map((o) => ({
              value: o,
              label: s(`options.${o}`),
            }))}
            selected={
              (step === "resources" ? draft.availableResources : step === "preferences" ? draft.workPreferences : draft.existingAbilities) ?? []
            }
            onSelect={(v) =>
              step === "resources"
                ? toggle("availableResources", v)
                : step === "preferences"
                  ? toggle("workPreferences", v, "not_sure")
                  : toggle("existingAbilities", v, "none")
            }
          />
        </>
      ) : null}

      {step === "time" ? (
        <ChoiceGroup
          label={s("title")}
          options={HOURS_BUCKETS.map((b) => ({ value: b.key, label: s(`options.${b.key}`) }))}
          selected={draft.hoursKey ? [draft.hoursKey] : []}
          onSelect={(v) => update({ hoursKey: v, availableHoursPerWeek: HOURS_BUCKETS.find((b) => b.key === v)!.hours })}
        />
      ) : null}

      {step === "capital" ? (
        <ChoiceGroup
          label={s("title")}
          options={CAPITAL_BUCKETS.map((b) => ({ value: b.key, label: s(`options.${b.key}`) }))}
          selected={draft.capitalKey ? [draft.capitalKey] : []}
          onSelect={(v) => update({ capitalKey: v, startingCapitalMinor: CAPITAL_BUCKETS.find((b) => b.key === v)!.minor })}
        />
      ) : null}

      {step === "priority" ? (
        <ChoiceGroup
          label={s("title")}
          options={PRIORITIES.map((o) => ({ value: o, label: s(`options.${o}`) }))}
          selected={draft.currentPriority ? [draft.currentPriority] : []}
          onSelect={(v) => update({ currentPriority: v as DiagnosticAnswers["currentPriority"] })}
        />
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          className="h-12 flex-1 rounded-2xl"
          disabled={stepIndex === 0 || saving}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
          {t("earn.v2.diagnostic.back")}
        </Button>
        <Button
          type="button"
          className="h-12 flex-[1.4] rounded-2xl"
          disabled={!stepValid() || saving}
          onClick={() => (isLast ? void finish() : setStepIndex((i) => Math.min(total - 1, i + 1)))}
        >
          {saving ? (
            <>
              <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
              {t("earn.v2.diagnostic.saving")}
            </>
          ) : isLast ? (
            t("earn.v2.diagnostic.finish")
          ) : (
            <>
              {t("earn.v2.diagnostic.next")}
              <ArrowRight className="ml-1 size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ChoiceGroup({
  label,
  options,
  selected,
  onSelect,
  multiple = false,
  columns = 1,
  showLabel = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onSelect: (value: string) => void;
  multiple?: boolean;
  columns?: 1 | 2;
  showLabel?: boolean;
}) {
  return (
    <div className="space-y-2">
      {showLabel ? <p className="text-sm font-medium">{label}</p> : null}
      <div
        role={multiple ? "group" : "radiogroup"}
        aria-label={label}
        className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-1")}
      >
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={multiple ? undefined : "radio"}
              aria-checked={multiple ? undefined : on}
              aria-pressed={multiple ? on : undefined}
              onClick={() => onSelect(o.value)}
              className={cn(
                "flex min-h-12 items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-3 text-left text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-primary bg-primary/8 text-primary" : "hover:bg-muted/50"
              )}
            >
              <span className="text-pretty">{o.label}</span>
              {on ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MoneyField({ id, label, valueMinor, onChange }: { id: string; label: string; valueMinor: number | undefined; onChange: (minor: number | undefined) => void }) {
  const [text, setText] = useState(valueMinor === undefined ? "" : String(valueMinor / 100));
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="h-12 rounded-2xl text-lg tabular-nums"
        value={text}
        placeholder="0"
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.trim() === "" ? undefined : toMinor(e.target.value));
        }}
      />
    </div>
  );
}
