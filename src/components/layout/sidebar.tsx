"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";
import { BrandMark } from "@/components/illustrations";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex">
      <div className="flex items-center gap-2 px-2 pb-6 text-lg font-semibold text-primary">
        <BrandMark size={24} />
        <span className="text-sidebar-foreground">Wealth OS</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-(--motion-normal) ease-(--ease-standard)",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              <span>{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
