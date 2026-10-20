"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SettingsSwitchProps = Omit<ComponentProps<"button">, "onChange" | "onClick" | "role" | "aria-checked" | "className"> & {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

/** Shared Profile switch; native button supplies Enter/Space keyboard activation. */
export function SettingsSwitch({ enabled, onChange, disabled, ...props }: SettingsSwitchProps) {
  return (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    disabled={disabled}
    {...props}
    onClick={() => onChange(!enabled)}
    className={cn(
      "relative inline-flex h-7 w-12 min-h-0! min-w-0! shrink-0 items-center rounded-full transition-colors duration-(--motion-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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
  );
}
