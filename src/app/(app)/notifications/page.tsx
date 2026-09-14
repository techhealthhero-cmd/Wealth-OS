import type { Metadata } from "next";

import { syncNotifications } from "@/features/engagement/notifications-sync";
import { getNotifications, getNotificationPreferences } from "@/features/engagement/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { NotificationList } from "@/features/engagement/components/notification-list";
import { NotificationPreferencesForm } from "@/features/engagement/components/notification-preferences-form";

export const metadata: Metadata = { title: "Notifications — Wealth OS" };

export default async function NotificationsPage() {
  await syncNotifications();

  const [notifications, preferences, profile] = await Promise.all([
    getNotifications({ limit: 50 }),
    getNotificationPreferences(),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">{dict.notifications.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.notifications.subtitle}</p>
      </div>
      <NotificationList notifications={notifications} />
      <NotificationPreferencesForm preferences={preferences} />
    </div>
  );
}
