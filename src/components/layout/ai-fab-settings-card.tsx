"use client";

import { useId } from "react";
import { Sparkles } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AI_FAB_IDLE_OPACITY_MAX,
  AI_FAB_IDLE_OPACITY_MIN,
  setAiFabIdleOpacity,
  useAiFabIdleOpacity,
} from "./ai-fab-preferences";

/**
 * Settings → floating AI button: the AssistiveTouch-style "idle opacity"
 * slider. Changes apply live to the button on this same page (it fades to
 * the new level after a few seconds untouched), so the user can see the
 * effect while dragging.
 */
export function AiFabSettingsCard() {
  const { t } = useTranslation();
  const value = useAiFabIdleOpacity();
  const sliderId = useId();
  const hintId = useId();
  const fill = ((value - AI_FAB_IDLE_OPACITY_MIN) / (AI_FAB_IDLE_OPACITY_MAX - AI_FAB_IDLE_OPACITY_MIN)) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("aiFab.settingsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
      </CardContent>
    </Card>
  );
}
