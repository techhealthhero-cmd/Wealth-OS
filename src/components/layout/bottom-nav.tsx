"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      aria-label="Primary"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors duration-(--motion-normal) ease-(--ease-standard)",
              active ? "text-foreground" : "text-muted-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            <span>{t(`nav.${item.key}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
