"use client";

import { useId } from "react";
import { BookOpen, Loader2, Play, Zap, Sparkles, CircleSlash } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_OPENING_MODE, OPENING_MODES, type OpeningMode } from "@/lib/notebook-covers/config";

const MODE_ICONS: Record<OpeningMode, LucideIcon> = {
  full: BookOpen,
  quick: Zap,
  first_time: Sparkles,
  off: CircleSlash,
};

/**
 * Settings → ธีมและหน้าปก → Animation เปิดสมุด. Four radio rows; picking one
 * saves it right away (the parent shows the row's spinner and a toast).
 * Every animated mode has its own preview button beside it — previewing
 * never changes the saved choice.
 */
export function OpeningAnimationSettings({
  value,
  pendingMode,
  onChange,
  onPreview,
}: {
  value: OpeningMode;
  pendingMode: OpeningMode | null;
  onChange: (mode: OpeningMode) => void;
  onPreview: (mode: OpeningMode) => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <Card>
      <CardHeader>
        <CardTitle id={titleId} className="text-base">
          {t("notebookCover.openingTitle")}
        </CardTitle>
        <CardDescription>{t("notebookCover.openingHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-labelledby={titleId} className="space-y-2">
          {OPENING_MODES.map((mode) => {
            const selected = mode === value;
            const pending = mode === pendingMode;
            const Icon = MODE_ICONS[mode];
            const name = t(`notebookCover.openingModes.${mode}.name`);
            return (
              <div
                key={mode}
                className={cn(
                  "flex items-stretch rounded-xl border bg-card transition-[border-color,background-color] duration-(--motion-fast)",
                  selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                )}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={pendingMode !== null}
                  onClick={() => !selected && onChange(mode)}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
                >
                  {/* Radio dot */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      selected ? "border-primary" : "border-muted-foreground/40"
                    )}
                  >
                    {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="text-sm font-semibold">{name}</span>
                      {pending ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-none font-medium text-muted-foreground tabular-nums">
                        {t(`notebookCover.openingModes.${mode}.duration`)}
                      </span>
                      {mode === DEFAULT_OPENING_MODE ? (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-primary dark:bg-primary/30 dark:text-foreground">
                          {t("notebookCover.defaultBadge")}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {t(`notebookCover.openingModes.${mode}.description`)}
                    </span>
                  </span>
                </button>
                {mode !== "off" ? (
                  <button
                    type="button"
                    onClick={() => onPreview(mode)}
                    aria-label={t("notebookCover.previewOf").replace("{name}", name)}
                    className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 border-l border-border/70 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-xl"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted">
                      <Play className="size-3.5 translate-x-px fill-current" aria-hidden="true" />
                    </span>
                    {t("notebookCover.preview")}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
