"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";

/**
 * 2026-09 reskin (v2, "Coinest" light green direction): the app defaults to
 * light — dark stays available as an opt-in secondary theme rather than
 * being removed. `resolvedTheme` is `undefined` during SSR/first paint;
 * treating that the same as "light" matches the actual default and avoids
 * needing a mount-guard effect just to pick an icon.
 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("theme.toggle")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <SunIcon aria-hidden="true" />
      ) : (
        <MoonIcon aria-hidden="true" />
      )}
    </Button>
  );
}
