"use client";

import { useId } from "react";
import { Ban, Check } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COVER_DECORATIONS,
  COVER_THEMES,
  MAX_COVER_NAME_LENGTH,
  type CoverDecorationId,
  type CoverPreferences,
  type CoverThemeId,
} from "@/lib/notebook-covers/config";
import { NotebookCover } from "./notebook-cover";
import { CoverDecoration } from "./cover-decoration";

/**
 * Large cover preview. Re-keyed on every change so the new cover settles in
 * with a short lift (.motion-reveal) — the "update the preview immediately" cue.
 */
export function CoverPreview({ prefs, className }: { prefs: CoverPreferences; className?: string }) {
  const key = `${prefs.theme}-${prefs.decorations.join(",")}`;
  return (
    <div className={cn("mx-auto w-full max-w-[13.5rem]", className)}>
      <div key={key} className="motion-reveal">
        <NotebookCover theme={prefs.theme} decorations={prefs.decorations} name={prefs.name} />
      </div>
    </div>
  );
}

/** Five cover thumbnails in one row (fits 375px without horizontal scroll). */
export function CoverThemeSelector({
  value,
  onChange,
}: {
  value: CoverThemeId;
  onChange: (theme: CoverThemeId) => void;
}) {
  const { t } = useTranslation();
  const selected = COVER_THEMES.find((theme) => theme.id === value) ?? COVER_THEMES[0];
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={t("notebookCover.chooseTitle")} className="grid grid-cols-5 gap-2 sm:gap-3">
        {COVER_THEMES.map((theme) => {
          const isSelected = theme.id === value;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={t(`notebookCover.themes.${theme.id}.name`)}
              onClick={() => onChange(theme.id)}
              className={cn(
                "relative rounded-lg p-1 transition-[transform,box-shadow,background-color] duration-(--motion-fast) ease-(--ease-standard)",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected ? "-translate-y-1 bg-primary/10 ring-2 ring-primary" : "hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              <NotebookCover theme={theme.id} />
              {isSelected ? (
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="text-center" aria-live="polite">
        <p className="text-sm font-semibold">{t(`notebookCover.themes.${selected.id}.name`)}</p>
        <p className="text-xs text-muted-foreground">{t(`notebookCover.themes.${selected.id}.description`)}</p>
      </div>
    </div>
  );
}

/** "No sticker" + the sticker catalogue (one sticker at most in v1). */
export function CoverDecorationPicker({
  value,
  onChange,
}: {
  value: readonly CoverDecorationId[];
  onChange: (decorations: CoverDecorationId[]) => void;
}) {
  const { t } = useTranslation();
  const current = value[0] ?? null;
  const options: (CoverDecorationId | null)[] = [null, ...COVER_DECORATIONS.map((d) => d.id)];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("notebookCover.stickerLabel")}</p>
      <div role="radiogroup" aria-label={t("notebookCover.stickerLabel")} className="grid grid-cols-3 gap-2">
        {options.map((id) => {
          const isSelected = id === current;
          const category = id ? COVER_DECORATIONS.find((d) => d.id === id)?.category : null;
          return (
            <button
              key={id ?? "none"}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(id ? [id] : [])}
              className={cn(
                "flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border bg-card px-1 py-2 text-center transition-[transform,box-shadow,border-color] duration-(--motion-fast) ease-(--ease-standard)",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40 active:scale-[0.98]"
              )}
            >
              {id ? (
                <CoverDecoration id={id} size={44} />
              ) : (
                <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground">
                  <Ban className="size-5" aria-hidden="true" />
                </span>
              )}
              <span className="text-xs font-medium">{t(`notebookCover.decorations.${id ?? "none"}`)}</span>
              {category ? (
                <span className="text-[10px] leading-none text-muted-foreground">{t(`notebookCover.categories.${category}`)}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CoverNameField({ value, onChange }: { value: string | null; onChange: (name: string | null) => void }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t("notebookCover.nameLabel")}</Label>
      <Input
        id={id}
        value={value ?? ""}
        maxLength={MAX_COVER_NAME_LENGTH}
        placeholder={t("notebookCover.namePlaceholder")}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value.length ? e.target.value : null)}
      />
      <p className="text-xs text-muted-foreground">
        {t("notebookCover.nameHint").replace("{n}", String(MAX_COVER_NAME_LENGTH))}
      </p>
    </div>
  );
}
