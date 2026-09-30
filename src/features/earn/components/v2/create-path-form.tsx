"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconChip } from "@/components/shared/icon-chip";
import { cn } from "@/lib/utils";
import { createIncomePath } from "@/features/earn/v2-actions";
import { INCOME_PATH_TYPES, type IncomePathType } from "@/lib/earn/types";
import { PATH_ICON_COMPONENTS } from "./path-icons";

/**
 * Choose one of the four path types and name the goal. Creating the path
 * also initializes its roadmap at step one with a first concrete mission.
 */
export function CreatePathForm({
  defaultType,
  defaultTitle,
  experimentKey,
}: {
  defaultType: IncomePathType | null;
  defaultTitle: string;
  experimentKey: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [type, setType] = useState<IncomePathType | null>(defaultType);
  const [title, setTitle] = useState(defaultTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !title.trim() || saving) return;
    setSaving(true);
    setError(null);
    const res = await createIncomePath({ pathType: type, title: title.trim(), experimentKey }).catch(() => ({ error: t("earn.v2.paths.createFailed") }) as { error: string; id?: string });
    if ("id" in res && res.id) {
      router.push(`/earn/paths/${res.id}`);
      return;
    }
    setSaving(false);
    setError(res.error ?? t("earn.v2.paths.createFailed"));
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{t("earn.v2.paths.chooseType")}</h2>
        <p className="text-sm text-muted-foreground">{t("earn.v2.paths.chooseTypeHint")}</p>
        {experimentKey ? <p className="text-xs font-medium text-primary">{t("earn.v2.paths.fromExperiment")}</p> : null}
      </div>

      <div role="radiogroup" aria-label={t("earn.v2.paths.chooseType")} className="grid grid-cols-2 gap-2.5">
        {INCOME_PATH_TYPES.map((p) => {
          const on = type === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setType(p)}
              className={cn(
                "relative flex min-h-36 flex-col items-center justify-center gap-2 rounded-3xl border bg-card p-3 text-center transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-primary bg-primary/8 ring-1 ring-primary/30" : "hover:bg-muted/40"
              )}
            >
              {on ? <Check className="absolute top-3 right-3 size-4 text-primary" aria-hidden="true" /> : null}
              <IconChip icon={PATH_ICON_COMPONENTS[p]} />
              <span className="font-semibold">{t(`earn.v2.pathTypes.${p}.title`)}</span>
              <span className="text-xs text-muted-foreground text-pretty">{t(`earn.v2.pathTypes.${p}.subtitle`)}</span>
            </button>
          );
        })}
      </div>

      {type === "investment" ? (
        <p className="rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">{t("earn.v2.paths.investmentNote")}</p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="path-title">{t("earn.v2.paths.titleLabel")}</Label>
        <Input
          id="path-title"
          className="h-12 rounded-2xl"
          value={title}
          maxLength={100}
          placeholder={t("earn.v2.paths.titlePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="h-12 w-full rounded-2xl text-base" disabled={!type || !title.trim() || saving}>
        {saving ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
            {t("earn.v2.paths.creating")}
          </>
        ) : (
          t("earn.v2.paths.create")
        )}
      </Button>
    </form>
  );
}
