"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";

const TABS = [
  { href: "/money/transactions", key: "nav.transactions" },
  { href: "/money/accounts", key: "nav.accounts" },
  { href: "/money/budget", key: "budget.title" },
  { href: "/money/assets", key: "assets.title" },
  { href: "/money/liabilities", key: "liabilities.title" },
  { href: "/money/net-worth", key: "netWorth.title" },
] as const;

export function MoneyTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex w-max gap-1 rounded-lg border bg-muted p-1">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
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
