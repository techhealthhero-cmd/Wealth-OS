"use client";

import { useActionState, useState } from "react";
import { ChevronDown } from "lucide-react";

import { updateNotificationPreferences } from "@/features/engagement/actions";
import { useTranslation } from "@/i18n/client";
import type { NotificationPreferences } from "@/types/database";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Collapsed by default — reported: 10+ always-visible checkboxes pushed the
 * one thing this page exists to show (the actual notification feed) below
 * the fold. Tapping the header reveals the same settings, not a separate
 * page, so nothing here changed except when it's shown — same
 * expand-on-tap pattern as safe-to-spend-card.tsx's "How is this
 * calculated?" disclosure.
 */
export function NotificationPreferencesForm({ preferences }: { preferences: NotificationPreferences | null }) {
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(updateNotificationPreferences, undefined);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <CardTitle className="text-base">{t("notifications.preferences")}</CardTitle>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-(--motion-normal) ease-(--ease-standard)", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </CardHeader>
      {expanded ? (
        <CardContent className="animate-in fade-in slide-in-from-top-1 duration-(--motion-normal)">
          <form action={formAction} className="space-y-3">
            {NOTIFICATION_CATEGORIES.map((category) => (
              <div key={category} className="flex items-center gap-2">
                <Checkbox id={category} name={category} defaultChecked={preferences?.[category] ?? true} />
                <Label htmlFor={category} className="font-normal">
                  {t(`notifications.categories.${category}`)}
                </Label>
              </div>
            ))}

            {state?.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : state?.success ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("notifications.preferencesSaved")}</p>
            ) : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? t("common.saving") : t("common.save")}
            </Button>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}
