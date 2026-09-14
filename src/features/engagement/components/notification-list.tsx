"use client";

import { useTransition } from "react";

import type { FinancialNotification } from "@/types/database";
import { markAllNotificationsRead, markNotificationRead } from "@/features/engagement/actions";
import { useTranslation } from "@/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function NotificationList({ notifications }: { notifications: FinancialNotification[] }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const hasUnread = notifications.some((n) => !n.is_read);

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{t("notifications.noNotifications")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {hasUnread ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => startTransition(async () => { await markAllNotificationsRead(); })}
          >
            {t("notifications.markAllRead")}
          </Button>
        </div>
      ) : null}
      <div className="grid gap-2">
        {notifications.map((n) => (
          <Card key={n.id} className={n.is_read ? "opacity-60" : undefined}>
            <CardContent className="flex items-start justify-between gap-2 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  {!n.is_read ? <Badge className="h-1.5 w-1.5 rounded-full p-0" /> : null}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
              </div>
              {!n.is_read ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => startTransition(async () => { await markNotificationRead(n.id); })}
                >
                  {t("common.confirm")}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
