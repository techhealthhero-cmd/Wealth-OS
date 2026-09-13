"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";

const TABS = [
  { href: "/earn", key: "earn.tabs.overview" },
  { href: "/earn/income", key: "earn.tabs.income" },
  { href: "/earn/skills", key: "earn.tabs.skills" },
  { href: "/earn/opportunities", key: "earn.tabs.opportunities" },
  { href: "/earn/missions", key: "earn.tabs.missions" },
] as const;

export function EarnTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex w-max gap-1 rounded-lg border bg-muted p-1">
        {TABS.map((tab) => {
          const active = tab.href === "/earn" ? pathname === "/earn" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
