"use client";

import { useId, useState, useTransition } from "react";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CoverDecorationPicker,
  CoverNameField,
  CoverPreview,
  CoverThemeSelector,
} from "@/components/notebook/cover-pickers";
import { NotebookOpening } from "@/components/notebook/notebook-opening";
import type { CoverPreferences } from "@/lib/notebook-covers/config";
import { getOpeningMode, type OpeningReason } from "@/lib/notebook-covers/playback";
import { saveCoverPreferences } from "@/features/notebook-cover/actions";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function samePrefs(a: CoverPreferences, b: CoverPreferences) {
  return (
    a.theme === b.theme &&
    (a.name ?? "") === (b.name ?? "") &&
    a.decorations.join(",") === b.decorations.join(",") &&
    a.openingAnimationEnabled === b.openingAnimationEnabled
  );
}

/**
 * Settings → ธีมและหน้าปก. Edits preview live; "บันทึกหน้าปก" persists them
 * (and, if the opening animation is on, opens the journal with the new
 * cover). The animation switch saves on its own, immediately, without
 * sneaking along any unsaved cover edits.
 */
export function CoverSettings({ initial, displayName }: { initial: CoverPreferences; displayName: string | null }) {
  const { t } = useTranslation();
  const toggleLabelId = useId();
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [opening, setOpening] = useState<{ mode: "full" | "reduced"; prefs: CoverPreferences } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isToggling, startToggling] = useTransition();

  const dirty = !samePrefs({ ...draft, openingAnimationEnabled: saved.openingAnimationEnabled }, saved);

  function play(reason: OpeningReason, prefs: CoverPreferences) {
    const mode = getOpeningMode({
      reason,
      enabled: prefs.openingAnimationEnabled,
      prefersReducedMotion: prefersReducedMotion(),
    });
    if (mode !== "none") setOpening({ mode, prefs });
  }

  function save() {
    const next = { ...draft, openingAnimationEnabled: saved.openingAnimationEnabled };
    startSaving(async () => {
      const result = await saveCoverPreferences(next);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSaved(next);
      toast.success(t("notebookCover.saved"));
      play("cover-change", next);
    });
  }

  function toggleAnimation() {
    const next = { ...saved, openingAnimationEnabled: !saved.openingAnimationEnabled };
    startToggling(async () => {
      const result = await saveCoverPreferences(next);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSaved(next);
      setDraft((d) => ({ ...d, openingAnimationEnabled: next.openingAnimationEnabled }));
    });
  }

  return (
    <div className="space-y-4">
      <Card variant="soft">
        <CardContent className="space-y-4 py-2">
          <CoverPreview prefs={draft} />
          <Button
            type="button"
            variant="outline"
            className="mx-auto flex bg-card"
            onClick={() => play("user-replay", draft)}
          >
            <BookOpen className="size-4" aria-hidden="true" />
            {t("notebookCover.openJournal")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5">
          <CoverThemeSelector value={draft.theme} onChange={(theme) => setDraft((d) => ({ ...d, theme }))} />
          <CoverDecorationPicker
            value={draft.decorations}
            onChange={(decorations) => setDraft((d) => ({ ...d, decorations }))}
          />
          <CoverNameField value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} />
          <div className="space-y-1.5">
            <Button type="button" className="w-full" disabled={!dirty || isSaving} onClick={save}>
              {isSaving ? t("notebookCover.saving") : t("notebookCover.save")}
            </Button>
            {dirty && !isSaving ? (
              <p className="text-center text-xs text-muted-foreground" aria-live="polite">
                {t("notebookCover.unsaved")}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p id={toggleLabelId} className="text-sm font-medium">
              {t("notebookCover.animationToggle")}
            </p>
            <p className="text-xs text-muted-foreground">{t("notebookCover.animationHint")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={saved.openingAnimationEnabled}
            aria-labelledby={toggleLabelId}
            disabled={isToggling}
            onClick={toggleAnimation}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-(--motion-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
              saved.openingAnimationEnabled ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-block size-6 rounded-full bg-background shadow-md transition-transform duration-(--motion-fast)",
                saved.openingAnimationEnabled ? "translate-x-5.5" : "translate-x-0.5"
              )}
            />
          </button>
        </CardContent>
      </Card>

      {opening ? (
        <NotebookOpening
          prefs={opening.prefs}
          mode={opening.mode}
          displayName={displayName}
          onDone={() => setOpening(null)}
        />
      ) : null}
    </div>
  );
}
