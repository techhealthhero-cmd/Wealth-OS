"use client";

import { useActionState } from "react";

import { updateNotificationPreferences } from "@/features/engagement/actions";
import { useTranslation } from "@/i18n/client";
import type { NotificationPreferences } from "@/types/database";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NotificationPreferencesForm({ preferences }: { preferences: NotificationPreferences | null }) {
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(updateNotificationPreferences, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("notifications.preferences")}</CardTitle>
      </CardHeader>
      <CardContent>
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
    </Card>
  );
}
