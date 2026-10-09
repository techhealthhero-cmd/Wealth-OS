"use client";

import { useState, useTransition } from "react";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CoverDecorationPicker,
  CoverNameField,
  CoverPreview,
  CoverThemeSelector,
} from "@/components/notebook/cover-pickers";
import { NotebookOpening } from "@/components/notebook/notebook-opening";
import type { CoverPreferences, OpeningMode } from "@/lib/notebook-covers/config";
import { getInAppVariant, type OpeningVariant } from "@/lib/notebook-covers/playback";
import { saveCoverPreferences } from "@/features/notebook-cover/actions";
import { OpeningAnimationSettings } from "./opening-animation-settings";

function samePrefs(a: CoverPreferences, b: CoverPreferences) {
  return (
    a.theme === b.theme &&
    (a.name ?? "") === (b.name ?? "") &&
    a.decorations.join(",") === b.decorations.join(",") &&
    a.openingMode === b.openingMode
  );
}

/**
 * Settings → ธีมและหน้าปก. Cover edits preview live and are kept with
 * "บันทึกหน้าปก" (after which the journal opens with the new cover, quickly,
 * unless animations are off). The opening-animation mode saves on its own
 * the moment it is picked, without sneaking along unsaved cover edits.
 * Previews never change anything saved.
 */
export function CoverSettings({ initial, displayName }: { initial: CoverPreferences; displayName: string | null }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [opening, setOpening] = useState<{ variant: OpeningVariant; prefs: CoverPreferences } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [pendingMode, setPendingMode] = useState<OpeningMode | null>(null);
  const [, startModeSave] = useTransition();

  const dirty = !samePrefs({ ...draft, openingMode: saved.openingMode }, saved);

  function play(variant: OpeningVariant | null, prefs: CoverPreferences) {
    if (variant) setOpening({ variant, prefs });
  }

  function save() {
    const next = { ...draft, openingMode: saved.openingMode };
    startSaving(async () => {
      const result = await saveCoverPreferences(next);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSaved(next);
      toast.success(t("notebookCover.saved"));
      play(getInAppVariant("cover-change", next.openingMode), next);
    });
  }

  function changeMode(mode: OpeningMode) {
    const next = { ...saved, openingMode: mode };
    setPendingMode(mode);
    startModeSave(async () => {
      const result = await saveCoverPreferences(next);
      setPendingMode(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSaved(next);
      toast.success(t("notebookCover.modeSaved").replace("{name}", t(`notebookCover.openingModes.${mode}.name`)));
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
            onClick={() => play("full", draft)}
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

      <OpeningAnimationSettings
        value={pendingMode ?? saved.openingMode}
        pendingMode={pendingMode}
        onChange={changeMode}
        onPreview={(mode) => play(getInAppVariant({ preview: mode }, saved.openingMode), draft)}
      />

      {opening ? (
        <NotebookOpening
          prefs={opening.prefs}
          variant={opening.variant}
          displayName={displayName}
          onDone={() => setOpening(null)}
        />
      ) : null}
    </div>
  );
}
