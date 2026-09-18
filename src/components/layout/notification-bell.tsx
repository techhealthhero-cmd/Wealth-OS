import Link from "next/link";
import { Bell } from "lucide-react";

import { getUnreadNotificationCount } from "@/features/engagement/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { Button } from "@/components/ui/button";

export async function NotificationBell() {
  const [unreadCount, profile] = await Promise.all([getUnreadNotificationCount(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      nativeButton={false}
      render={<Link href="/notifications" />}
      aria-label={dict.notifications.title}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-background"
        />
      ) : null}
    </Button>
  );
}
