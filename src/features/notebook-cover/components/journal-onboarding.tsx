"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CoverDecorationPicker,
  CoverNameField,
  CoverPreview,
  CoverThemeSelector,
} from "@/components/notebook/cover-pickers";
import { NotebookCover } from "@/components/notebook/notebook-cover";
import { NotebookOpening } from "@/components/notebook/notebook-opening";
import { DEFAULT_COVER_PREFERENCES, type CoverPreferences } from "@/lib/notebook-covers/config";
import { getInAppVariant, type OpeningVariant } from "@/lib/notebook-covers/playback";
import { markLaunchHandled } from "@/lib/notebook-covers/launch-state";
import { saveCoverPreferences, type SaveCoverResult } from "@/features/notebook-cover/actions";

type Step = "welcome" | "choose" | "decorate";
const STEPS: Step[] = ["welcome", "choose", "decorate"];

/**
 * First-time cover onboarding, shown once after the profile onboarding:
 * welcome → choose a cover → (optional) sticker + name → the journal opens →
 * dashboard. Skippable at every step; whatever the outcome (finish, skip,
 * even a failed save) it ends on the dashboard — a cosmetic step must never
 * stand between someone and their money.
 */
export function JournalOnboarding({ displayName }: { displayName: string | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [prefs, setPrefs] = useState<CoverPreferences>(DEFAULT_COVER_PREFERENCES);
  const [opening, setOpening] = useState<{ variant: OpeningVariant; prefs: CoverPreferences } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const saveRef = useRef<Promise<SaveCoverResult> | null>(null);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  async function goToDashboard() {
    const result = await saveRef.current;
    // "Not ready" = migration not applied yet; the default cover is used
    // silently. Any other failure gets a quiet note — they can retry from
    // Settings — but never blocks entry.
    if (result && !result.success && result.code !== "not_ready") toast.error(result.error);
    router.replace("/dashboard");
  }

  /** `animate`: finishing with "เริ่มใช้งาน" opens the journal; Skip goes straight in. */
  function finish(final: CoverPreferences, animate: boolean) {
    if (finishing) return;
    setFinishing(true);
    // Whether or not it animates, this is how they enter the app: the
    // dashboard must not play a launch opening on top of it.
    markLaunchHandled();
    saveRef.current = saveCoverPreferences(final, { markChosen: true }).catch(
      (): SaveCoverResult => ({ success: false, error: t("notebookCover.errors.saveFailed"), code: "failed" })
    );
    const variant = animate ? getInAppVariant("onboarding", final.openingMode) : null;
    if (variant === null) void goToDashboard();
    else setOpening({ variant, prefs: final });
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
      <div className="flex h-10 items-center justify-between">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={() => setStep(STEPS[stepIndex - 1])}
            className="-ml-1 inline-flex items-center gap-0.5 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t("notebookCover.back")}
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-1.5" aria-label={t("notebookCover.stepOf").replace("{n}", String(stepIndex + 1)).replace("{total}", String(STEPS.length))}>
          {STEPS.map((s, i) => (
            <span
              key={s}
              aria-hidden="true"
              className={cn("h-1.5 rounded-full transition-all duration-(--motion-normal)", i === stepIndex ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => finish(step === "welcome" ? DEFAULT_COVER_PREFERENCES : { ...prefs, decorations: [], name: null }, false)}
          disabled={finishing}
          className="rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("notebookCover.skip")}
        </button>
      </div>

      {step === "welcome" ? (
        <div key="welcome" className="motion-reveal flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="w-[min(60vw,15rem)]">
            <NotebookCover theme={prefs.theme} />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-bold text-balance">{t("notebookCover.welcomeTitle")}</h1>
            <p className="text-muted-foreground">{t("notebookCover.welcomeSubtitle")}</p>
          </div>
          <Button size="lg" className="w-full" onClick={() => setStep("choose")}>
            {t("notebookCover.welcomeCta")}
          </Button>
        </div>
      ) : null}

      {step === "choose" ? (
        <div key="choose" className="motion-reveal flex flex-1 flex-col gap-5 pt-2">
          <header className="space-y-1 text-center">
            <h1 className="font-heading text-xl font-bold">{t("notebookCover.chooseTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("notebookCover.chooseSubtitle")}</p>
          </header>
          <CoverPreview prefs={prefs} className="max-w-[12rem]" />
          <CoverThemeSelector value={prefs.theme} onChange={(theme) => setPrefs((p) => ({ ...p, theme }))} />
          <Button size="lg" className="mt-auto w-full" onClick={() => setStep("decorate")}>
            {t("notebookCover.chooseCta")}
          </Button>
        </div>
      ) : null}

      {step === "decorate" ? (
        <div key="decorate" className="motion-reveal flex flex-1 flex-col gap-5 pt-2">
          <header className="space-y-1 text-center">
            <h1 className="font-heading text-xl font-bold">{t("notebookCover.decorateTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("notebookCover.decorateSubtitle")}</p>
          </header>
          <CoverPreview prefs={prefs} className="max-w-[9.5rem]" />
          <CoverDecorationPicker value={prefs.decorations} onChange={(decorations) => setPrefs((p) => ({ ...p, decorations }))} />
          <CoverNameField value={prefs.name} onChange={(name) => setPrefs((p) => ({ ...p, name }))} />
          <Button size="lg" className="mt-auto w-full" disabled={finishing} onClick={() => finish(prefs, true)}>
            {t("notebookCover.startCta")}
          </Button>
        </div>
      ) : null}

      {opening ? (
        <NotebookOpening
          prefs={opening.prefs}
          variant={opening.variant}
          displayName={displayName}
          exit="hold"
          onDone={() => void goToDashboard()}
        />
      ) : null}
    </div>
  );
}
