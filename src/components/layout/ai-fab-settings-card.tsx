"use client";

import { useId } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AI_FAB_IDLE_OPACITY_MAX,
  AI_FAB_IDLE_OPACITY_MIN,
  setAiFabEnabled,
  setAiFabIdleOpacity,
  useAiFabEnabled,
  useAiFabIdleOpacity,
} from "./ai-fab-preferences";

/**
 * Settings → floating AI button: an on/off switch for the button itself,
 * plus the AssistiveTouch-style "idle opacity" slider (shown only while the
 * button is on). Both apply live to the button on this same page.
 */
export function AiFabSettingsCard() {
  const { t } = useTranslation();
  const value = useAiFabIdleOpacity();
  const enabled = useAiFabEnabled();
  const sliderId = useId();
  const hintId = useId();
  const toggleLabelId = useId();
  const fill = ((value - AI_FAB_IDLE_OPACITY_MIN) / (AI_FAB_IDLE_OPACITY_MAX - AI_FAB_IDLE_OPACITY_MIN)) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("aiFab.settingsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p id={toggleLabelId} className="text-sm font-medium">
              {t("aiFab.showButton")}
            </p>
            <p className="text-xs text-muted-foreground">
              {enabled ? t("aiFab.showButtonOnHint") : t("aiFab.showButtonOffHint")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-labelledby={toggleLabelId}
            onClick={() => setAiFabEnabled(!enabled)}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-(--motion-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              enabled ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-block size-6 rounded-full bg-background shadow-md transition-transform duration-(--motion-fast)",
                enabled ? "translate-x-5.5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>

        {enabled ? (
        <div className="space-y-2">
        <label htmlFor={sliderId} className="text-sm font-medium">
          {t("aiFab.idleOpacity")}
        </label>
        <div className="flex items-center gap-3">
          <input
            id={sliderId}
            type="range"
            min={AI_FAB_IDLE_OPACITY_MIN}
            max={AI_FAB_IDLE_OPACITY_MAX}
            step={5}
            value={value}
            aria-describedby={hintId}
            aria-valuetext={`${value}%`}
            onChange={(e) => setAiFabIdleOpacity(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full accent-primary [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-md"
            style={{
              background: `linear-gradient(to right, var(--primary) ${fill}%, var(--muted) ${fill}%)`,
            }}
          />
          <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">{value}%</span>
        </div>
        <p id={hintId} className="text-xs text-muted-foreground">
          {t("aiFab.idleOpacityHint")}
        </p>
        </div>
        ) : (
          // Hiding the button must never strand the user without AI access.
          <Link href="/ai" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {t("aiFab.openAiPage")}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
